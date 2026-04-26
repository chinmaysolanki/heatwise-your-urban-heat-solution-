// ============================================================
// HeatWise — Manual Measurement Input
// src/components/ManualMeasurement/ManualMeasurement.tsx
//
// Fallback for when AR is unavailable or the user prefers
// to type dimensions directly. Provides live area calculation
// and validation.
// ============================================================

import React, { useEffect, useState, useCallback } from "react";
import styles from "./ManualMeasurement.module.css";

interface ManualMeasurementProps {
  onComplete:      (widthM: number, lengthM: number) => void;
  initialWidthM?:  number;
  initialLengthM?: number;
}

export function ManualMeasurement({
  onComplete,
  initialWidthM  = 0,
  initialLengthM = 0,
}: ManualMeasurementProps) {

  const [width,  setWidth]  = useState(initialWidthM  > 0 ? String(initialWidthM)  : "");
  const [length, setLength] = useState(initialLengthM > 0 ? String(initialLengthM) : "");
  const [errors, setErrors] = useState<{ width?: string; length?: string }>({});

  useEffect(() => {
    setWidth(initialWidthM > 0 ? String(initialWidthM) : "");
  }, [initialWidthM]);

  useEffect(() => {
    setLength(initialLengthM > 0 ? String(initialLengthM) : "");
  }, [initialLengthM]);

  const widthNum  = parseFloat(width)  || 0;
  const lengthNum = parseFloat(length) || 0;
  const area      = widthNum > 0 && lengthNum > 0
    ? (widthNum * lengthNum).toFixed(1)
    : null;

  const validate = useCallback((): boolean => {
    const newErrors: typeof errors = {};

    if (!width || widthNum <= 0) {
      newErrors.width = "Enter a width greater than 0";
    } else if (widthNum < 0.5) {
      newErrors.width = "Minimum width is 0.5m";
    } else if (widthNum > 200) {
      newErrors.width = "Width seems too large — double-check";
    }

    if (!length || lengthNum <= 0) {
      newErrors.length = "Enter a length greater than 0";
    } else if (lengthNum < 0.5) {
      newErrors.length = "Minimum length is 0.5m";
    } else if (lengthNum > 200) {
      newErrors.length = "Length seems too large — double-check";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [width, length, widthNum, lengthNum]);

  const handleSubmit = useCallback(() => {
    if (validate()) {
      onComplete(widthNum, lengthNum);
    }
  }, [validate, widthNum, lengthNum, onComplete]);

  // Numeric input with +/− stepper
  const Stepper = ({
    label, value, onChange, error, unit = "m",
  }: {
    label:    string;
    value:    string;
    onChange: (v: string) => void;
    error?:   string;
    unit?:    string;
  }) => {
    const num = parseFloat(value) || 0;
    const dec = (value.includes(".")) ? 1 : 0;
    const step = 0.5;

    return (
      <div className={styles.field}>
        <label className={styles.label}>{label}</label>
        <div className={`${styles.inputRow} ${error ? styles.hasError : ""}`}>
          <button
            type="button"
            className={styles.stepper}
            onClick={() => onChange(String(Math.max(0, +(num - step).toFixed(1))))}
            aria-label={`Decrease ${label}`}
          >
            −
          </button>
          <div className={styles.inputWrap}>
            <input
              type="number"
              inputMode="decimal"
              value={value}
              onChange={e => onChange(e.target.value)}
              onBlur={() => {
                // Normalise on blur
                if (value && !isNaN(num)) {
                  onChange(String(Math.round(num * 10) / 10));
                }
              }}
              className={styles.input}
              placeholder="0.0"
              min="0"
              max="200"
              step="0.1"
            />
            <span className={styles.unit}>{unit}</span>
          </div>
          <button
            type="button"
            className={styles.stepper}
            onClick={() => onChange(String(+(num + step).toFixed(1)))}
            aria-label={`Increase ${label}`}
          >
            +
          </button>
        </div>
        {error && <span className={styles.error}>{error}</span>}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerIcon}>📐</span>
        <div>
          <p className={styles.headerTitle}>Enter Dimensions</p>
          <p className={styles.headerSub}>
            Measure with a tape or step it out (1 step ≈ 0.8m)
          </p>
        </div>
      </div>

      <div className={styles.diagram}>
        <svg viewBox="0 0 200 140" className={styles.diagramSvg}>
          {/* Space rectangle */}
          <rect x="30" y="20" width="140" height="100"
            fill="rgba(52,211,153,0.08)"
            stroke="rgba(52,211,153,0.5)"
            strokeWidth="1.5"
            rx="4"
          />
          {/* Width arrow */}
          <line x1="30" y1="10" x2="170" y2="10"
            stroke="rgba(52,211,153,0.6)" strokeWidth="1.5"
            markerStart="url(#arrow)" markerEnd="url(#arrow)"
          />
          <text x="100" y="8" textAnchor="middle"
            fill="rgba(52,211,153,0.9)" fontSize="9" fontWeight="600">
            {widthNum > 0 ? `${widthNum}m` : "width"}
          </text>

          {/* Length arrow */}
          <line x1="185" y1="20" x2="185" y2="120"
            stroke="rgba(52,211,153,0.6)" strokeWidth="1.5"
            markerStart="url(#arrow)" markerEnd="url(#arrow)"
          />
          <text x="196" y="74" textAnchor="middle"
            fill="rgba(52,211,153,0.9)" fontSize="9" fontWeight="600"
            transform="rotate(90 196 74)">
            {lengthNum > 0 ? `${lengthNum}m` : "length"}
          </text>

          {/* Area label inside rect */}
          {area && (
            <text x="100" y="72" textAnchor="middle"
              fill="rgba(52,211,153,0.7)" fontSize="13" fontWeight="700">
              {area} m²
            </text>
          )}

          <defs>
            <marker id="arrow" markerWidth="6" markerHeight="6"
              refX="3" refY="3" orient="auto">
              <path d="M0,0 L0,6 L6,3 z" fill="rgba(52,211,153,0.6)" />
            </marker>
          </defs>
        </svg>
      </div>

      <Stepper
        label="Width"
        value={width}
        onChange={setWidth}
        error={errors.width}
      />
      <Stepper
        label="Length"
        value={length}
        onChange={setLength}
        error={errors.length}
      />

      {area && (
        <div className={styles.areaBadge}>
          <span className={styles.areaLabel}>Total area</span>
          <span className={styles.areaValue}>{area} m²</span>
        </div>
      )}

      <button
        className={styles.submitBtn}
        onClick={handleSubmit}
        disabled={!widthNum || !lengthNum}
      >
        Use These Dimensions
      </button>
    </div>
  );
}
