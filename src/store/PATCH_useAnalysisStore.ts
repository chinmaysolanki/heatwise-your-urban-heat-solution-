// ============================================================
// HeatWise — Store Integration Patch
// src/store/PATCH_useAnalysisStore.ts
//
// This file shows EXACTLY what to add to your existing
// useAnalysisStore to wire in AR measurement results.
//
// DO NOT import this file — copy the relevant pieces into
// your existing useAnalysisStore.ts
// ============================================================

// ── 1. Add to your ProjectInput type (models/index.ts) ──────
//
// interface ProjectInput {
//   ...existing fields...
//
//   // AR measurement result — populated after MeasurementScreen
//   arMeasurement?: ARMeasurementResult;
// }


// ── 2. Add to your AnalysisState interface ──────────────────
//
// interface AnalysisState {
//   ...existing fields...
//
//   measurementMethod: 'ar' | 'manual' | null;
// }


// ── 3. Add to your initial state ────────────────────────────
//
// measurementMethod: null,


// ── 4. Add this action to your store ────────────────────────
//
// setMeasurement: (
//   widthM: number,
//   lengthM: number,
//   method: 'ar' | 'manual',
//   arResult?: ARMeasurementResult,
// ) => void;


// ── 5. Implement the action ──────────────────────────────────
//
// setMeasurement: (widthM, lengthM, method, arResult) =>
//   set(s => ({
//     input: {
//       ...s.input,
//       widthM,
//       lengthM,
//       arMeasurement: arResult,
//     },
//     measurementMethod: method,
//   })),


// ── 6. Call from MeasurementScreen ──────────────────────────
//
// In src/screens/MeasurementScreen/index.tsx:
//
// import { useAnalysisStore } from '../../store/useAnalysisStore';
//
// const { setMeasurement } = useAnalysisStore();
//
// const handleMeasurementComplete = (widthM, lengthM) => {
//   setMeasurement(widthM, lengthM, 'ar');
//   router.push(ROUTES.ENVIRON);
// };
//
// // And for AR:
// <AROverlay
//   onMeasurementComplete={(w, l) => {
//     // arResult contains confidence, rawCorners, calibration etc.
//     const arResult = ...; // from useARMeasurement
//     setMeasurement(w, l, 'ar', arResult);
//   }}
//   onCancel={() => setMode('selecting')}
//   floorLevel={session.input.floorLevel ?? 1}
// />


// ── 7. Add to pages/ ─────────────────────────────────────────
//
// In Next.js, create pages/project/measure.tsx:
//
// export { default } from '../../src/screens/MeasurementScreen';
//
// This wires the screen to the /project/measure route.


// ── 8. Required npm packages ─────────────────────────────────
//
// All AR features use browser-native APIs — no new packages needed.
// The only dependency is framer-motion which you already have.
//
// Optional for better touch handling on Android:
// npm install @use-gesture/react
//
// ── 9. Capacitor Android notes ───────────────────────────────
//
// Camera via getUserMedia works in Capacitor's WebView on Android.
// No additional Capacitor plugin needed for the basic AR flow.
//
// For production, add to AndroidManifest.xml:
//   <uses-permission android:name="android.permission.CAMERA" />
//
// And in capacitor.config.ts:
//   server: {
//     allowNavigation: ['*'],
//   }
//
// The WebView must be served over HTTPS (or localhost) for
// getUserMedia to be available — this is automatic in Capacitor.
