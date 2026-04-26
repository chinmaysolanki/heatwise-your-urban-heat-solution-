/**
 * HeatWise design tokens — Natural Green Light theme
 * Palette: light-gray bg · forest green primary · sage accent
 *          amber warmth · coral heat-alert · dark charcoal text
 *
 * Replaces the previous Midnight Aurora dark palette.
 * Inspired by: living rooftops, Indian gardens, sunlit greenery.
 */
export const T = {
  // ── Backgrounds ──────────────────────────────────────────────
  bg:           "#F2F3F7",               // light gray page bg
  bgAlt:        "#FFFFFF",               // white card surface
  bgMid:        "#F8F9FA",               // off-white panel

  // ── Panels ───────────────────────────────────────────────────
  panel:        "rgba(255,255,255,0.97)",
  panelBright:  "rgba(255,255,255,1.00)",

  // ── Primary — Forest Green ────────────────────────────────────
  green:        "#2D6A4F",               // ← primary brand (forest green)
  greenLight:   "#74C69D",               // lighter sage
  greenDark:    "#1B4332",               // deep forest
  greenDim:     "rgba(45,106,79,0.10)",
  greenGlow:    "rgba(45,106,79,0.22)",

  // ── Teal — secondary ecosystem ───────────────────────────────
  teal:         "#40916C",
  tealDim:      "rgba(64,145,108,0.10)",

  // ── Sky / Sage accent ─────────────────────────────────────────
  sky:          "#52B788",               // sage green accent
  skyDim:       "rgba(82,183,136,0.10)",

  // ── Amber / Warmth ────────────────────────────────────────────
  earth:        "#D97706",               // warm amber
  sun:          "#F59E0B",               // golden amber
  sunDim:       "rgba(245,158,11,0.12)",

  // ── Heat / Alert ──────────────────────────────────────────────
  heat:         "#E65100",               // urban heat orange
  heatDim:      "rgba(230,81,0,0.09)",
  red:          "#EF4444",               // red error

  // ── Text ──────────────────────────────────────────────────────
  text:         "#374151",               // dark gray body
  textBright:   "#111827",               // near-black headings
  textDim:      "#9CA3AF",               // muted metadata
  textEarth:    "#D97706",               // amber label

  // ── Borders ───────────────────────────────────────────────────
  border:       "rgba(0,0,0,0.07)",
  borderBright: "rgba(0,0,0,0.16)",
  borderSky:    "rgba(82,183,136,0.20)",
  borderEarth:  "rgba(217,119,6,0.22)",

  // ── Action card backgrounds ───────────────────────────────────
  cardGreen:    "#E8F5EC",
  cardBlue:     "#E3F0FD",
  cardAmber:    "#FFF4E1",
  cardPurple:   "#F3E8FB",

  // ── Legacy aliases (keeps T.cyan / T.orange / T.gold working) ──
  cyan:         "#52B788",
  cyanDim:      "rgba(82,183,136,0.10)",
  orange:       "#E65100",
  gold:         "#F59E0B",
};
