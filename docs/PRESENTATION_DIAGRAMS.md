# HeatWise — Presentation Diagrams
**For: Investor / Team Meeting**  |  March 2026

---

## DIAGRAM 1 — The Problem We Solve

```
 INDIAN CITY ROOFTOP TODAY          WITH HEATWISE
 ──────────────────────────         ─────────────

  ████████████████████████           🌿🌱🪴🌾🌵🌺
  ████ BARE CONCRETE  ████    ──►    🌿 GREEN GARDEN 🌾
  ████ 45°C surface   ████           🌵 22-28°C surface
  ████████████████████████           🌿🌺🪴🌱🌾🌵

  Problems:                          Results:
  • Urban Heat Island                ✅ −3.8°C average cooling
  • High AC energy bills             ✅ −22% energy consumption
  • Air pollution + CO₂              ✅ 1.2T CO₂ offset/year
  • Dead unusable space              ✅ Usable green space
  • No expert guidance               ✅ AI-generated plan in minutes
```

---

## DIAGRAM 2 — 5-Step User Journey

```
   STEP 1          STEP 2          STEP 3          STEP 4          STEP 5
  ─────────       ─────────       ─────────       ─────────       ─────────

  📱 SCAN          📋 TELL US      🤖 AI PLAN      🌿 3D VIEW      🔧 INSTALL
  ─────────       ─────────       ─────────       ─────────       ─────────
  Point phone     Sun/water/      Instant plant   See your        Certified
  at your         wind/budget     recommendation  rooftop in      installer
  rooftop         details         + layout        3D before       quotes in
  AR measures     (2 min form)    generated       installing      24 hours
  area in m²                      in <10 sec

  [Camera AR]     [Smart Form]    [ML Engine]     [Three.js]      [Partner Net]
```

---

## DIAGRAM 3 — AI Recommendation Engine

```
                         USER INPUT
                    (space, sun, water, budget)
                              │
                              ▼
              ┌───────────────────────────────┐
              │     LAYER 1: ML MODEL          │
              │   Python · Trained on          │
              │   install outcomes data        │
              │   Confidence: HIGH             │
              └──────────────┬────────────────┘
                    Works? ──┤ Fails?
                    │         │
                    │         ▼
                    │  ┌──────────────────────┐
                    │  │  LAYER 2: CATALOG    │
                    │  │  HYBRID ENGINE (TS)  │
                    │  │  51 species × 8 trait│
                    │  │  scoring dimensions  │
                    │  │  Confidence: MEDIUM  │
                    │  └──────────┬───────────┘
                    │    Works? ──┤ Fails?
                    │             │
                    │             ▼
                    │  ┌──────────────────────┐
                    │  │  LAYER 3: RULES-ONLY │
                    │  │  Pure TypeScript     │
                    │  │  Always available    │
                    │  │  Confidence: LOW     │
                    │  └──────────────────────┘
                    │             │
                    └─────────────┘
                              │
                              ▼
                    SCORED PLANT LIST
                  + Heat Reduction Estimate
                  + Confidence Rating
```

---

## DIAGRAM 4 — Species Intelligence (51 Plants)

```
                      51 CATALOG SPECIES

    HERBS (10)          ORNAMENTALS (8)     SUCCULENTS (7)
    ──────────          ───────────────     ──────────────
    Tulsi holy          Bougainvillea       Sedum ★
    Basil sweet         Marigold            Prickly pear ★
    Mint                Portulaca           Adenium ★
    Coriander           Zinnia              Aloe vera
    Curry leaf          Crossandra          Jade plant
    Lemongrass          Duranta             Caladium
    Brahmi              Vinca               —
    Fenugreek           Chrysanthemum
    Geranium            —
    —

    VEGETABLES (8)      FOLIAGE (7)         GRASSES (4)
    ──────────          ───────────         ───────────
    Cherry tomato       Pothos ★            Vetiver ★★
    Chilli              Snake plant ★       Lemongrass ★★
    Malabar spinach     Dracaena            Dense lemongrass
    Okra                Coleus              Bamboo dwarf
    Bitter gourd        Spider plant
    Eggplant            Areca palm
    Luffa               Wandering jew
    Malabar spinach

    ★ = Drought-tolerant (scarce water scenarios)
    ★★ = High cooling score + wind resistant
```

---

## DIAGRAM 5 — Platform Architecture

```
  ┌─────────────────────────────────────────────────────────┐
  │                    CLIENTS                               │
  │   📱 React PWA    📱 Android App    💻 Admin Dashboard  │
  └────────────────────────┬────────────────────────────────┘
                           │  HTTPS
  ┌────────────────────────▼────────────────────────────────┐
  │              NEXT.JS API LAYER (60+ routes)              │
  │  /recommendations  /reports  /installers  /geospatial   │
  └──────┬──────────────────┬──────────────────┬────────────┘
         │                  │                  │
  ┌──────▼──────┐   ┌───────▼───────┐  ┌──────▼──────┐
  │  PRISMA ORM │   │  RECOMMENDATION│  │  OPENAI API │
  │  SQLite/    │   │  ENGINE        │  │  GPT-4V     │
  │  PostgreSQL │   │  ML + Hybrid   │  │  Visuals    │
  └─────────────┘   │  + Rules       │  └─────────────┘
                    └───────────────┘
```

---

## DIAGRAM 6 — Business Model

```
  FREE USERS                    REVENUE STREAMS
  ──────────                    ───────────────

  User scans rooftop            1. INSTALLER COMMISSION
  Gets AI recommendation    ──►    10–15% of install value
  Views 3D garden plan           ┌─► Avg install: ₹80,000–2,00,000
                                 │   Commission: ₹8,000–30,000/job
                                 │
  Request install quote     ──►  2. PREMIUM FEATURES
  Certified installer           │   • Multi-project management
  contacts in 24h               │   • Advanced AI visuals
                                 │   • Irrigation planning
                                 │
  Post-install follow-up    ──►  3. DATA & INSIGHTS
                                     • Regional cooling data
                                     • Species performance
                                     • City planning partnerships
```

---

## DIAGRAM 7 — Go-To-Market: Indian Cities

```
                    TARGET CITIES (Phase 1)

  TIER 1 METRO                    TIER 2 HOT CITIES
  ─────────────                   ─────────────────
  🏙 Delhi NCR       45°C+         🏙 Jaipur      46°C+
  🏙 Mumbai          38°C+         🏙 Nagpur      46°C+
  🏙 Bengaluru       34°C+         🏙 Lucknow     44°C+
  🏙 Hyderabad       40°C+         🏙 Ahmedabad   45°C+
  🏙 Chennai         38°C+         🏙 Indore      42°C+

  Target property types:
  ┌──────────────┬──────────────────┬──────────────────┐
  │  Residential │  Housing Society  │   Commercial     │
  │  Rooftops    │  (50–500 units)   │  Office/Retail   │
  │  ₹60K–1.5L   │  ₹5L–50L project  │  ₹10L–2Cr       │
  └──────────────┴──────────────────┴──────────────────┘
```

---

## DIAGRAM 8 — Technical Moat

```
  WHAT COMPETITORS DO             WHAT HEATWISE DOES
  ───────────────────             ──────────────────

  Generic green roof PDFs    →    Personalized AI plan in 60 sec
  Manual site survey needed  →    AR measurement from your phone
  One-size-fits-all plants   →    51-species catalog × 8 conditions
  No data on outcomes        →    Immutable telemetry → ML improves
  No installer network       →    Certified partner network + RFQ
  Desktop-only tools         →    Mobile-first PWA + Android app
  No post-install tracking   →    Longitudinal follow-up system
```

---

## DIAGRAM 9 — Key Metrics (Current Demo)

```
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │   51         │  │  −3.8°C      │  │  60 sec      │  │  3-layer     │
  │  Species     │  │  Avg cooling │  │  Time to      │  │  AI fallback │
  │  in catalog  │  │  prediction  │  │  recommendation│  │  (always on) │
  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘

  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │  179         │  │  7           │  │  55+         │  │  100%        │
  │  Species     │  │  Regression  │  │  API routes  │  │  Scenario    │
  │  aliases     │  │  test cases  │  │  in platform │  │  pass rate   │
  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

---

*Use these diagrams in presentations. Mermaid / draw.io versions available on request.*
