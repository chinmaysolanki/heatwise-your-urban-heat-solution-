import { useCallback, useEffect, useState } from "react";
import type { LiveARSessionState, WorldPoint3D, LiveARMeasurementResult } from "./types";
import { buildMeasurementResult } from "./geometry";
import { createNoopTrackingAdapter, initialSessionState, type LiveARTrackingAdapter } from "./tracking";

export function useLiveARMeasurement(adapter?: LiveARTrackingAdapter) {
  const trackingAdapter = adapter ?? createNoopTrackingAdapter();
  const [state, setState] = useState<LiveARSessionState>(() => initialSessionState());

  useEffect(() => {
    let updates = 0;
    const unsubFrame = trackingAdapter.onFrame(quality => {
      setState(prev => ({ ...prev, trackingQuality: quality }));
    });
    const unsubTap = trackingAdapter.onTap((p: WorldPoint3D) => {
      updates += 1;
      setState(prev => {
        const points = [...prev.points, p];
        const result = buildMeasurementResult({ points, trackingQuality: prev.trackingQuality, updates });
        return {
          ...prev,
          points,
          edges: result.edges,
          polygon: result.polygon,
          resultPreview: result,
        };
      });
    });
    return () => {
      unsubFrame();
      unsubTap();
    };
  }, [trackingAdapter]);

  const start = useCallback(async () => {
    await trackingAdapter.startSession();
    setState(prev => ({ ...prev, active: true }));
  }, [trackingAdapter]);

  const stop = useCallback(async () => {
    await trackingAdapter.endSession();
    setState(prev => ({ ...prev, active: false }));
  }, [trackingAdapter]);

  const resetPoints = useCallback(() => {
    setState(prev => ({
      ...prev,
      points: [],
      edges: [],
      polygon: null,
      resultPreview: null,
    }));
  }, []);

  const removeLastPoint = useCallback(() => {
    setState(prev => {
      if (!prev.points.length) return prev;
      const points = prev.points.slice(0, -1);
      const result = buildMeasurementResult({ points, trackingQuality: prev.trackingQuality });
      return {
        ...prev,
        points,
        edges: result.edges,
        polygon: result.polygon,
        resultPreview: result,
      };
    });
  }, []);

  const finalize = useCallback<() => LiveARMeasurementResult | null>(() => {
    if (!state.points.length) return null;
    return buildMeasurementResult({ points: state.points, trackingQuality: state.trackingQuality });
  }, [state.points, state.trackingQuality]);

  return {
    state,
    start,
    stop,
    resetPoints,
    removeLastPoint,
    finalize,
  };
}

