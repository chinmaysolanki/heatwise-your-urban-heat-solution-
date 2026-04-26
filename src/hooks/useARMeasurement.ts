// ============================================================
// HeatWise — useARMeasurement Hook
// src/hooks/useARMeasurement.ts
//
// The single React hook for the AR measurement flow.
// Manages the full session lifecycle:
//   idle → requesting_permission → initialising →
//   calibrating → placing_corners → confirming →
//   processing → complete
//
// Consumers only interact with this hook — they never
// import camera services or math utilities directly.
// ============================================================

import {
  useRef, useState, useCallback,
  useEffect, useReducer,
} from "react";

import type {
  ARSession,
  ARSessionState,
  ARMeasurementResult,
  CornerID,
  CornerSet,
  ScreenPoint,
  DeviceOrientation,
  CameraStream,
} from "../types/ar.types";

import {
  checkCapabilities,
  requestCameraPermission,
  openCamera,
  attachStreamToVideo,
  subscribeToOrientation,
  computeTiltAngle,
  estimateCameraHeight,
} from "../services/arCameraService";

import {
  computeRealWorldDimensions,
  estimateConfidence,
  estimateCameraFOV,
} from "../utils/perspectiveMath";

import {
  renderAROverlay,
} from "../utils/arCanvasRenderer";

// ─── Default Corner Positions ────────────────────────────────
// Sensible starting positions before the user moves them.
// These are fractions of the canvas (0–1) converted at runtime.

const DEFAULT_CORNER_FRACS: Record<CornerID, [number, number]> = {
  tl: [0.15, 0.20],
  tr: [0.85, 0.20],
  br: [0.85, 0.75],
  bl: [0.15, 0.75],
};

const CORNER_ORDER: CornerID[] = ["tl", "tr", "br", "bl"];

// ─── State Reducer ────────────────────────────────────────────

type ARAction =
  | { type: "SET_STATE";       state:  ARSessionState }
  | { type: "SET_ERROR";       error:  string }
  | { type: "PLACE_CORNER";    id: CornerID; point: ScreenPoint }
  | { type: "MOVE_CORNER";     id: CornerID; point: ScreenPoint }
  | { type: "RESET_CORNERS" }
  | { type: "SET_RESULT";      result: ARMeasurementResult }
  | { type: "SET_ORIENTATION"; tilt: number; height: number }
  | { type: "RESET" };

function buildDefaultCorners(w: number, h: number): CornerSet {
  const makeCorner = (id: CornerID) => {
    const [fx, fy] = DEFAULT_CORNER_FRACS[id];
    return {
      id,
      screen:   { x: fx * w, y: fy * h },
      isPlaced: false,
      label:    id.toUpperCase(),
    };
  };
  return {
    tl: makeCorner("tl"),
    tr: makeCorner("tr"),
    br: makeCorner("br"),
    bl: makeCorner("bl"),
  };
}

function initialState(w = 0, h = 0): ARSession {
  return {
    state:          "idle",
    corners:        buildDefaultCorners(w, h),
    placedCount:    0,
    activeCorner:   "tl",
    deviceTilt:     45,
    cameraHeightM:  1.4,
    result:         null,
    error:          null,
    canvasRef:      null,
    videoRef:       null,
  };
}

function reducer(session: ARSession, action: ARAction): ARSession {
  switch (action.type) {

    case "SET_STATE":
      return { ...session, state: action.state, error: null };

    case "SET_ERROR":
      return { ...session, state: "error", error: action.error };

    case "PLACE_CORNER": {
      const updated: CornerSet = {
        ...session.corners,
        [action.id]: {
          ...session.corners[action.id],
          screen:   action.point,
          isPlaced: true,
        },
      };
      const placedCount  = Object.values(updated).filter(c => c.isPlaced).length;
      const nextCorner   = CORNER_ORDER.find(id => !updated[id].isPlaced) ?? null;
      const nextState: ARSessionState = placedCount === 4 ? "confirming" : "placing_corners";

      return {
        ...session,
        corners:      updated,
        placedCount,
        activeCorner: nextCorner,
        state:        nextState,
      };
    }

    case "MOVE_CORNER":
      return {
        ...session,
        corners: {
          ...session.corners,
          [action.id]: {
            ...session.corners[action.id],
            screen: action.point,
          },
        },
      };

    case "RESET_CORNERS": {
      const canvas = document.querySelector("canvas[data-ar]") as HTMLCanvasElement | null;
      const w = canvas?.width  ?? 360;
      const h = canvas?.height ?? 640;
      return {
        ...session,
        corners:      buildDefaultCorners(w, h),
        placedCount:  0,
        activeCorner: "tl",
        state:        "placing_corners",
        result:       null,
      };
    }

    case "SET_RESULT":
      return { ...session, result: action.result, state: "complete" };

    case "SET_ORIENTATION":
      return { ...session, deviceTilt: action.tilt, cameraHeightM: action.height };

    case "RESET":
      return initialState();

    default:
      return session;
  }
}

// ─── Hook ─────────────────────────────────────────────────────

export interface UseARMeasurementReturn {
  // State
  session:        ARSession;

  // Refs to attach to DOM elements
  videoRef:       React.RefObject<HTMLVideoElement | null>;
  canvasRef:      React.RefObject<HTMLCanvasElement | null>;

  // Actions
  start:          () => Promise<void>;
  placeCorner:    (point: ScreenPoint) => void;
  moveCorner:     (id: CornerID, point: ScreenPoint) => void;
  confirmMeasurement: () => void;
  retakeMeasurement:  () => void;
  reset:          () => void;

  // Computed
  canConfirm:     boolean;
  isCameraActive: boolean;
}

export function useARMeasurement(): UseARMeasurementReturn {
  const videoRef  = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<CameraStream | null>(null);
  const rafRef    = useRef<number>(0);
  const orientSub = useRef<{ unsubscribe: () => void } | null>(null);

  // Drag state for corner adjustment
  const dragRef = useRef<{ id: CornerID | null; active: boolean }>({
    id: null, active: false,
  });

  const [session, dispatch] = useReducer(reducer, initialState());

  // ── Render loop ─────────────────────────────────────────────
  const renderLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;

    // Sync canvas to video dimensions
    if (canvas.width  !== video.videoWidth  && video.videoWidth  > 0) {
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    renderAROverlay(canvas, {
      corners:      session.corners,
      placedCount:  session.placedCount,
      activeCorner: session.activeCorner,
      sessionState: session.state,
      widthM:       session.result?.widthM  ?? null,
      lengthM:      session.result?.lengthM ?? null,
      skewWarning:  false,
    });

    rafRef.current = requestAnimationFrame(renderLoop);
  }, [session]);

  useEffect(() => {
    if (session.state === "placing_corners" ||
        session.state === "confirming"      ||
        session.state === "calibrating") {
      rafRef.current = requestAnimationFrame(renderLoop);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [session.state, renderLoop]);

  // ── Start AR session ─────────────────────────────────────────
  const start = useCallback(async () => {
    dispatch({ type: "SET_STATE", state: "requesting_permission" });

    // Check capabilities
    const caps = await checkCapabilities();
    if (!caps.hasCamera) {
      dispatch({ type: "SET_ERROR", error: "No camera found on this device." });
      return;
    }
    if (!caps.isSecureContext) {
      dispatch({ type: "SET_ERROR", error: "Camera requires HTTPS. Please use a secure connection." });
      return;
    }

    // Request permission
    const perm = await requestCameraPermission();
    if (perm === "denied") {
      dispatch({ type: "SET_ERROR", error: "Camera permission denied. Please allow camera access in your device settings." });
      return;
    }

    dispatch({ type: "SET_STATE", state: "initialising" });

    // Open camera
    try {
      const cameraStream = await openCamera();
      streamRef.current  = cameraStream;

      if (!videoRef.current) {
        dispatch({ type: "SET_ERROR", error: "Video element not mounted." });
        return;
      }

      await attachStreamToVideo(videoRef.current, cameraStream.stream);

      // Initialise canvas size to match video
      if (canvasRef.current) {
        canvasRef.current.width  = videoRef.current.videoWidth  || 1280;
        canvasRef.current.height = videoRef.current.videoHeight || 720;

        // Re-init corners at actual canvas size
        dispatch({ type: "RESET_CORNERS" });
      }

    } catch (err) {
      dispatch({
        type:  "SET_ERROR",
        error: `Failed to open camera: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
      return;
    }

    // Subscribe to device orientation
    if (caps.hasOrientationAPI) {
      orientSub.current = await subscribeToOrientation((orient) => {
        const tilt   = computeTiltAngle(orient);
        const height = estimateCameraHeight(tilt);
        dispatch({ type: "SET_ORIENTATION", tilt, height });
      });
    }

    dispatch({ type: "SET_STATE", state: "calibrating" });

    // Auto-advance to placing corners after brief calibration
    setTimeout(() => {
      dispatch({ type: "SET_STATE", state: "placing_corners" });
    }, 1500);

  }, []);

  // ── Place a corner at a tap/click position ───────────────────
  const placeCorner = useCallback((point: ScreenPoint) => {
    if (session.state !== "placing_corners") return;
    if (!session.activeCorner) return;
    dispatch({ type: "PLACE_CORNER", id: session.activeCorner, point });
  }, [session.state, session.activeCorner]);

  // ── Drag a placed corner to adjust it ───────────────────────
  const moveCorner = useCallback((id: CornerID, point: ScreenPoint) => {
    dispatch({ type: "MOVE_CORNER", id, point });
  }, []);

  // ── Confirm and compute dimensions ───────────────────────────
  const confirmMeasurement = useCallback(() => {
    if (session.placedCount !== 4) return;

    dispatch({ type: "SET_STATE", state: "processing" });

    const canvas = canvasRef.current;
    if (!canvas) {
      dispatch({ type: "SET_ERROR", error: "Canvas not available." });
      return;
    }

    const fovDeg    = streamRef.current?.hFovDeg ?? 65;
    const calibration = {
      hFovDeg:        fovDeg,
      cameraHeightM:  session.cameraHeightM,
      tiltAngleDeg:   session.deviceTilt,
      pixelsPerMetre: 0, // computed inside perspectiveMath
      hasSensorData:  orientSub.current !== null,
    };

    // Run perspective calculation
    const perspResult = computeRealWorldDimensions(
      session.corners,
      calibration,
      canvas.width,
      canvas.height,
    );

    if (!perspResult.valid) {
      dispatch({
        type:  "SET_ERROR",
        error: perspResult.reason ?? "Could not compute dimensions. Please retry.",
      });
      return;
    }

    // Estimate confidence
    const markedArea = canvas.width * canvas.height * 0.4; // approx
    const totalArea  = canvas.width * canvas.height;
    const confidence = estimateConfidence(
      perspResult, calibration, markedArea, totalArea,
    );

    const result: ARMeasurementResult = {
      widthM:     perspResult.widthM,
      lengthM:    perspResult.lengthM,
      areaSqM:    parseFloat((perspResult.widthM * perspResult.lengthM).toFixed(2)),
      confidence,
      method:     "ar_corners",
      rawCorners: session.corners,
      calibration,
      capturedAt: new Date().toISOString(),
    };

    dispatch({ type: "SET_RESULT", result });

  }, [session]);

  // ── Retake (go back to placing corners) ─────────────────────
  const retakeMeasurement = useCallback(() => {
    dispatch({ type: "RESET_CORNERS" });
  }, []);

  // ── Full reset ───────────────────────────────────────────────
  const reset = useCallback(() => {
    streamRef.current?.stop();
    streamRef.current = null;
    orientSub.current?.unsubscribe();
    orientSub.current = null;
    cancelAnimationFrame(rafRef.current);
    dispatch({ type: "RESET" });
  }, []);

  // ── Cleanup on unmount ───────────────────────────────────────
  useEffect(() => {
    return () => {
      streamRef.current?.stop();
      orientSub.current?.unsubscribe();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return {
    session,
    videoRef,
    canvasRef,
    start,
    placeCorner,
    moveCorner,
    confirmMeasurement,
    retakeMeasurement,
    reset,
    canConfirm:     session.placedCount === 4 && session.state === "confirming",
    isCameraActive: ["calibrating", "placing_corners", "confirming"].includes(session.state),
  };
}
