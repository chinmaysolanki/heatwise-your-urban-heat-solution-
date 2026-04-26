// ============================================================
// HeatWise — AR Overlay Component
// src/components/AROverlay/AROverlay.tsx
//
// The full-screen AR measurement view.
// Renders: camera feed + canvas overlay + control buttons.
//
// Touch/pointer interaction:
//   - Tap   → place next corner
//   - Drag  → move a placed corner
//   - Pinch → (future: zoom)
// ============================================================

import React, { useCallback, useRef, useEffect } from "react";
import type { CornerID, ScreenPoint } from "../../types/ar.types";
import type { ARSpatialMapping } from "@/models";
import { useARMeasurement } from "../../hooks/useARMeasurement";
import styles from "./AROverlay.module.css";

// ─── Props ───────────────────────────────────────────────────

interface AROverlayProps {
  onMeasurementComplete: (widthM: number, lengthM: number) => void;
  onCancel:              () => void;
  floorLevel:            number;  // passed for context (not used in math directly)
  spatialMapping?:       ARSpatialMapping;
}

// ─── Component ────────────────────────────────────────────────

export function AROverlay({
  onMeasurementComplete,
  onCancel,
  spatialMapping,
}: AROverlayProps) {

  const {
    session,
    videoRef,
    canvasRef,
    start,
    placeCorner,
    moveCorner,
    confirmMeasurement,
    retakeMeasurement,
    reset,
    canConfirm,
    isCameraActive,
  } = useARMeasurement();

  // Track which corner is being dragged
  const dragState = useRef<{
    cornerID: CornerID | null;
    isDragging: boolean;
  }>({ cornerID: null, isDragging: false });

  // Start AR on mount
  useEffect(() => {
    start();
    return () => reset();
  }, []);

  // Forward complete result to parent
  useEffect(() => {
    if (session.state === "complete" && session.result) {
      onMeasurementComplete(
        session.result.widthM,
        session.result.lengthM,
      );
    }
  }, [session.state, session.result]);

  // ── Touch/Pointer event helpers ──────────────────────────────

  /** Convert a pointer event to canvas-space coordinates */
  const toCanvasPoint = useCallback((
    e: React.PointerEvent<HTMLCanvasElement>,
  ): ScreenPoint => {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();

    // Scale from CSS pixels to canvas pixels
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  }, [canvasRef]);

  /** Find if a point is close to a placed corner (for drag) */
  const findNearbyCorner = useCallback((
    point: ScreenPoint,
  ): CornerID | null => {
    const HIT_RADIUS = 30 * (canvasRef.current ?
      canvasRef.current.width / canvasRef.current.getBoundingClientRect().width : 1
    );

    for (const id of ["tl", "tr", "br", "bl"] as CornerID[]) {
      const corner = session.corners[id];
      if (!corner.isPlaced) continue;

      const dx = corner.screen.x - point.x;
      const dy = corner.screen.y - point.y;
      if (Math.sqrt(dx*dx + dy*dy) < HIT_RADIUS) return id;
    }
    return null;
  }, [session.corners, canvasRef]);

  const handlePointerDown = useCallback((
    e: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    e.preventDefault();
    const point    = toCanvasPoint(e);
    const nearCorner = findNearbyCorner(point);

    if (nearCorner) {
      // Start dragging an existing corner
      dragState.current = { cornerID: nearCorner, isDragging: true };
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    }
  }, [toCanvasPoint, findNearbyCorner]);

  const handlePointerMove = useCallback((
    e: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    e.preventDefault();
    if (!dragState.current.isDragging || !dragState.current.cornerID) return;

    const point = toCanvasPoint(e);
    moveCorner(dragState.current.cornerID, point);
  }, [toCanvasPoint, moveCorner]);

  const handlePointerUp = useCallback((
    e: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    e.preventDefault();

    if (dragState.current.isDragging) {
      // End drag — do not place new corner
      dragState.current = { cornerID: null, isDragging: false };
      return;
    }

    // Tap — place next corner
    const point = toCanvasPoint(e);
    placeCorner(point);
  }, [toCanvasPoint, placeCorner]);

  const handlePointerCancel = useCallback(() => {
    dragState.current = { cornerID: null, isDragging: false };
  }, []);

  // ── Render ───────────────────────────────────────────────────

  const anchors = spatialMapping?.anchors ?? [];

  return (
    <div className={styles.container}>

      {/* Camera feed */}
      <video
        ref={videoRef}
        className={styles.video}
        playsInline
        muted
        autoPlay
      />

      {/* AR overlay canvas */}
      {isCameraActive && (
        <canvas
          ref={canvasRef}
          data-ar="true"
          className={styles.canvas}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        />
      )}

      {/* Loading / Permission / Error states */}
      {session.state === "idle" && (
        <div className={styles.overlay}>
          <div className={styles.stateCard}>
            <span className={styles.stateIcon}>📐</span>
            <p className={styles.stateTitle}>AR Measurement</p>
            <p className={styles.stateBody}>Point your camera at the space you want to measure</p>
            <button className={styles.primaryBtn} onClick={start}>
              Open Camera
            </button>
          </div>
        </div>
      )}

      {session.state === "requesting_permission" && (
        <div className={styles.overlay}>
          <div className={styles.stateCard}>
            <span className={styles.stateIcon}>📷</span>
            <p className={styles.stateTitle}>Camera Permission</p>
            <p className={styles.stateBody}>Allow camera access when prompted</p>
          </div>
        </div>
      )}

      {session.state === "initialising" && (
        <div className={styles.overlay}>
          <div className={styles.stateCard}>
            <div className={styles.spinner} />
            <p className={styles.stateBody}>Starting camera...</p>
          </div>
        </div>
      )}

      {session.state === "error" && (
        <div className={styles.overlay}>
          <div className={`${styles.stateCard} ${styles.errorCard}`}>
            <span className={styles.stateIcon}>⚠️</span>
            <p className={styles.stateTitle}>Camera Error</p>
            <p className={styles.stateBody}>{session.error}</p>
            <button className={styles.primaryBtn} onClick={() => { reset(); start(); }}>
              Try Again
            </button>
            <button className={styles.ghostBtn} onClick={onCancel}>
              Enter Manually Instead
            </button>
          </div>
        </div>
      )}

      {/* Confirm / Retake bar — shown when all 4 corners are placed */}
      {(session.state === "confirming") && (
        <div className={styles.confirmBar}>
          <div className={styles.confirmMetrics}>
            {session.result ? (
              <>
                <span className={styles.metricPill}>
                  {session.result.widthM.toFixed(1)}m wide
                </span>
                <span className={styles.metricPill}>
                  {session.result.lengthM.toFixed(1)}m long
                </span>
                <span className={`${styles.metricPill} ${styles.confidencePill}`}>
                  {session.result.confidence} confidence
                </span>
              </>
            ) : (
              <span className={styles.metricHint}>Adjust corners if needed</span>
            )}
          </div>
          <div className={styles.confirmActions}>
            <button
              className={styles.ghostBtn}
              onClick={retakeMeasurement}
            >
              Retake
            </button>
            <button
              className={styles.primaryBtn}
              onClick={confirmMeasurement}
              disabled={!canConfirm}
            >
              Confirm Measurement
            </button>
          </div>
        </div>
      )}

      {/* Processing state */}
      {session.state === "processing" && (
        <div className={styles.processingBar}>
          <div className={styles.spinner} />
          <span>Calculating dimensions...</span>
        </div>
      )}

      {/* Debug: spatial anchors list */}
      {anchors.length > 0 && (
        <div className={styles.debugAnchors}>
          <div className={styles.debugAnchorsHeader}>AR Spatial Anchors</div>
          <div className={styles.debugAnchorsList}>
            {anchors.map((a) => (
              <div key={a.id} className={styles.debugAnchorRow}>
                <span className={styles.debugAnchorLabel}>
                  [{a.type}] {a.label}
                </span>
                <span className={styles.debugAnchorCoords}>
                  x:{a.positionM.x.toFixed(2)} y:{a.positionM.y.toFixed(2)} z:{a.positionM.z.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top bar — cancel button */}
      <div className={styles.topBar}>
        <button
          className={styles.cancelBtn}
          onClick={() => { reset(); onCancel(); }}
          aria-label="Cancel AR measurement"
        >
          ✕
        </button>
        <span className={styles.topBarTitle}>Measure Space</span>
        {session.placedCount > 0 && session.state === "placing_corners" && (
          <button
            className={styles.resetCornersBtn}
            onClick={retakeMeasurement}
          >
            Reset
          </button>
        )}
      </div>

    </div>
  );
}
