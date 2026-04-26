// ============================================================
// HeatWise — Measurement Screen
// src/screens/MeasurementScreen/index.tsx
//
// Orchestrates the full measurement step:
//   1. Checks AR capability
//   2. Shows AR mode by default, manual fallback available
//   3. Writes result to useAnalysisStore on completion
//   4. Navigates to EnvironmentInputScreen
// ============================================================

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import { AROverlay } from "../../components/AROverlay/AROverlay";
import { ManualMeasurement } from "../../components/ManualMeasurement/ManualMeasurement";
import { checkCapabilities } from "../../services/arCameraService";
import styles from "./MeasurementScreen.module.css";

// Import your existing analysis store
// import { useAnalysisStore } from "../../store/useAnalysisStore";

type MeasurementMode = "selecting" | "ar" | "manual";

export default function MeasurementScreen() {
  const router  = useRouter();

  // Uncomment when store is wired:
  // const { setInput, session } = useAnalysisStore();

  const [mode,       setMode]       = useState<MeasurementMode>("selecting");
  const [arCapable,  setArCapable]  = useState<boolean | null>(null);
  const [floorLevel, setFloorLevel] = useState(1);

  // Check AR capability on mount
  useEffect(() => {
    checkCapabilities().then(caps => {
      setArCapable(caps.hasCamera && caps.isSecureContext);
    });
    // Get floor level from store if available:
    // setFloorLevel(session.input.floorLevel ?? 1);
  }, []);

  // Called by both AR and Manual when measurement is done
  const handleMeasurementComplete = useCallback((
    widthM: number,
    lengthM: number,
  ) => {
    // Write to store:
    // setInput({ widthM, lengthM });

    // For now, log and navigate
    console.log("Measurement complete:", { widthM, lengthM });

    // Navigate to next step
    router.push("/project/environment");
  }, [router]);

  // ── Mode selection screen ────────────────────────────────────
  if (mode === "selecting") {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <button
            className={styles.backBtn}
            onClick={() => router.back()}
          >
            ←
          </button>
          <div className={styles.progress}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: "40%" }} />
            </div>
            <span className={styles.stepLabel}>Step 2 of 5</span>
          </div>
        </div>

        <div className={styles.content}>
          <h1 className={styles.title}>Measure Your Space</h1>
          <p className={styles.subtitle}>
            How would you like to capture the dimensions?
          </p>

          <div className={styles.modeCards}>
            {/* AR Mode */}
            <motion.button
              className={`${styles.modeCard} ${!arCapable ? styles.modeCardDisabled : ""}`}
              onClick={() => arCapable && setMode("ar")}
              whileHover={arCapable ? { scale: 1.02 } : {}}
              whileTap={arCapable ? { scale: 0.98 } : {}}
              disabled={!arCapable}
            >
              <div className={styles.modeCardIcon}>
                <span>📸</span>
              </div>
              <div className={styles.modeCardContent}>
                <h3 className={styles.modeCardTitle}>
                  AR Camera
                  <span className={styles.recommendedBadge}>Recommended</span>
                </h3>
                <p className={styles.modeCardDesc}>
                  Point your camera at the space and tap the four corners
                  to measure automatically.
                </p>
                {!arCapable && arCapable !== null && (
                  <p className={styles.unavailableNote}>
                    Camera not available on this device
                  </p>
                )}
              </div>
              <span className={styles.modeCardArrow}>→</span>
            </motion.button>

            {/* Manual Mode */}
            <motion.button
              className={styles.modeCard}
              onClick={() => setMode("manual")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className={styles.modeCardIcon}>
                <span>📏</span>
              </div>
              <div className={styles.modeCardContent}>
                <h3 className={styles.modeCardTitle}>Enter Manually</h3>
                <p className={styles.modeCardDesc}>
                  Type or step out the width and length in metres.
                  Fast and always available.
                </p>
              </div>
              <span className={styles.modeCardArrow}>→</span>
            </motion.button>
          </div>

          <p className={styles.hint}>
            💡 For best AR accuracy, photograph from standing height
            with the full space visible.
          </p>
        </div>
      </div>
    );
  }

  // ── AR mode ──────────────────────────────────────────────────
  if (mode === "ar") {
    return (
      <AROverlay
        onMeasurementComplete={handleMeasurementComplete}
        onCancel={() => setMode("selecting")}
        floorLevel={floorLevel}
      />
    );
  }

  // ── Manual mode ──────────────────────────────────────────────
  if (mode === "manual") {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <button
            className={styles.backBtn}
            onClick={() => setMode("selecting")}
          >
            ←
          </button>
          <div className={styles.progress}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: "40%" }} />
            </div>
            <span className={styles.stepLabel}>Step 2 of 5</span>
          </div>
        </div>

        <div className={styles.manualWrapper}>
          <ManualMeasurement
            onComplete={handleMeasurementComplete}
          />
        </div>
      </div>
    );
  }

  return null;
}
