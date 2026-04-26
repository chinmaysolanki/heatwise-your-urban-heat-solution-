# HeatWise — Product Architecture Document
## Use Case · Workflow · User Flow Journey

---

## 1. THE PROBLEM

Cities across India experience **Urban Heat Islands (UHI)** — rooftops and concrete surfaces absorb heat and raise local temperatures by **3–5°C above rural baseline**. Building owners face:

- No visibility into how hot their rooftop actually is
- No guidance on what green cover would cool it
- No accessible path to connect with qualified green installers
- No way to track environmental impact post-installation

HeatWise solves this with a **scan → plan → install → track** loop inside a single mobile app.

---

## 2. USE CASE SUMMARY

| Who | What they do | Value delivered |
|-----|-------------|-----------------|
| **Homeowner / Flat owner** | Scans rooftop, gets plant plan, connects to installer | Lower surface temp, reduced AC bills |
| **Housing society / RWA** | Plans terrace/rooftop greening at building scale | Collective cooling impact, CSR compliance |
| **Commercial building owner** | Quantifies green cover ROI, gets certified install | Energy reduction, green certifications |
| **Green installer / contractor** | Receives qualified leads, submits quotes, tracks jobs | Lead generation, job management |

---

## 3. HIGH-LEVEL WORKFLOW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HEATWISE APP WORKFLOW                               │
├──────────┬──────────┬──────────────┬─────────────┬────────────┬────────────┤
│  AUTH    │  SCAN    │   ANALYSE    │  RECOMMEND  │  INSTALL   │  TRACK     │
│          │          │              │             │            │            │
│ Phone    │ AR       │ AI runs      │ Garden      │ Installer  │ Impact     │
│ OTP      │ measure  │ rules +      │ layout +    │ quote      │ dashboard  │
│ login    │ space    │ ML engine    │ species     │ workflow   │ & CO₂      │
│          │          │              │             │            │            │
│ 30 sec   │ 60 sec   │ 8 sec        │ Instant     │ 24–48 hrs  │ Ongoing    │
└──────────┴──────────┴──────────────┴─────────────┴────────────┴────────────┘
```

---

## 4. COMPLETE USER FLOW JOURNEY

### 4.1 Authentication

```
┌─────────────────────────────────────────────────────┐
│                  SPLASH SCREEN                      │
│         (3D animated city intro, 2.5s)              │
└────────────────────┬────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────┐
│               ONBOARDING SCREEN                     │
│    3-slide feature walkthrough                      │
│    Checks: localStorage.hw_profile                  │
└──────────┬──────────────────────────────────────────┘
           │
     ┌─────┴──────┐
     ↓            ↓
 Profile       No Profile
 exists        yet
     │            │
     ↓            ↓
  HOME        PROFILE SETUP SCREEN
              (name, city, gardening interest)
                   │
                   ↓ POST /api/user/profile
                   │
                  HOME
```

**Phone OTP Detail:**
```
Enter Phone Number
      ↓
POST /api/phone-auth/send-otp
      ↓
Enter 6-digit OTP  [HEATWISE_DEV_OTP=true → logs to console]
      ↓
POST /api/phone-auth/verify-otp
      ↓
Session created → navigate to HOME
```

---

### 4.2 Main Journey — Create Project

```
HOME DASHBOARD
│
│  [+ New Project]
↓
┌─────────────────────────────────────────────────────┐
│              PROJECT CREATION SCREEN                │
│  • Project name                                     │
│  • Surface type: Rooftop / Balcony / Terrace /      │
│                  Backyard / Courtyard / Indoor      │
│  • Primary goal: Cooling / Biodiversity /           │
│                  Aesthetic / Air Quality            │
│  POST /api/projects  →  Creates Project in DB       │
└────────────────────┬────────────────────────────────┘
                     ↓
              MEASURE SCREEN
         [Choose measurement method]
         ┌──────────┴──────────┐
         ↓                     ↓
   AR LIVE MODE         MANUAL / PHOTO MODE
```

---

### 4.3 Measurement — Two Paths

#### Path A: Live AR Measurement
```
LIVE AR MEASUREMENT SCREEN
│
│  Camera opens (WebRTC getUserMedia)
│  User taps 4 corners of the space on screen
│  │
│  Algorithm:
│  ├─ Perspective rectification (projective geometry)
│  ├─ rectifyQuadrilateral: avg opposing edges in screen space
│  ├─ computeMetricScale: uses camera height + tilt angle + FOV
│  │     distanceM = cameraHeight / cos(tiltAngle)
│  │     visibleWidth = 2 × distanceM × tan(hFOV/2)
│  │     metresPerPixel = visibleWidth / imageWidth
│  └─ Output: widthM, lengthM (clamped 0.5m–200m)
│
│  Tracking quality: none → limited → good → excellent
│  Area via shoelace formula on XZ-projected polygon
│
└─ [Confirm] → stores {widthM, lengthM, floorLevel}
                         ↓
                  ENVIRONMENT SCREEN
```

#### Path B: Photo Capture + AR Analysis
```
PHOTO CAPTURE SCREEN
│
│  Camera captures still image of space
│  Image stored as data URI in PhotoSession
│
└─ [Next] → PHOTO AR MEASUREMENT SCREEN
              │
              │  Overlay AR analysis on photo
              │  Same perspective geometry engine
              │
              └─ [Confirm] → ENVIRONMENT SCREEN
```

---

### 4.4 Environment Configuration

```
ENVIRONMENT SCREEN
│
│  Auto-detect (Geolocation API):
│  ├─ GET /api/geospatial/enrich-project  → urban heat, climate zone
│  ├─ GET /api/geospatial/microclimate    → local temp, humidity
│  └─ GET /api/geospatial/site-exposure  → sun hours, wind exposure
│
│  Manual override inputs:
│  ├─ Sun exposure:  Full / Partial / Shade
│  ├─ Wind level:    High / Medium / Low
│  ├─ Water access:  Yes / No
│  └─ Floor level:   1 / 2 / 3+
│
│  Saved as: EnvironmentSnapshot in DB
│
└─ [Save & Continue]
        ↓
  ANALYSIS SCREEN
```

---

### 4.5 AI Analysis Engine

```
ANALYSIS SCREEN  (~8 second animated sequence)
│
│  Orchestration: orchestrateLayoutRecommendations.ts
│
│  Strategy (priority order):
│  ┌────────────────────────────────────────────┐
│  │  1. ML MODEL (Python subprocess)           │
│  │     • Trained on species telemetry         │
│  │     • Scores candidates by space features  │
│  │     • mergeMlIntoLayoutRecommendations.ts  │
│  │                                            │
│  │  2. CATALOG HYBRID FALLBACK                │
│  │     • Rules + species catalog lookup       │
│  │     • catalogHybridFallback.ts (37KB)      │
│  │                                            │
│  │  3. RULES-ONLY FALLBACK                    │
│  │     • Pure heuristics                      │
│  │     • rulesOnlyFallback.ts                 │
│  └────────────────────────────────────────────┘
│
│  Eligibility filtering:
│  layoutEligibility.ts → filters candidates before scoring
│
│  Output:
│  ├─ scoredPlants[]    → species + quantity + zone placement
│  ├─ heatReductionSummary → estimatedDropC, coverage%, confidence
│  ├─ layoutSchema      → zone arrangement
│  └─ telemetryMeta     → modelVersion, rulesVersion (immutable log)
│
└─ Auto-navigate → GARDEN LAYOUT SCREEN
```

---

### 4.6 Garden Layout & Results

```
GARDEN LAYOUT SCREEN
│
│  Top-down zone map:
│  ├─ Perimeter band (green — shade/windbreak plants)
│  ├─ Centre beds (blue — statement species)
│  ├─ Corner containers (brown — movable pots)
│  └─ Compass + scale bar
│
│  Metrics strip:
│  ├─ Temperature drop: −{X}°C
│  ├─ Green coverage: {X}%
│  ├─ CO₂ sequestered: {area × 0.021} T/yr
│  └─ Confidence: High / Medium / Low
│
│  Tabs: [Plan] [Zone Details] [Plant List]
│
├─ [View Results]    → RESULT SCREEN
├─ [View Report]     → REPORT SCREEN
└─ [Request Quote]   → INSTALL SCREEN
```

```
RESULT SCREEN
│
│  Full recommendation breakdown:
│  ├─ Heatmap overlay on photo
│  ├─ Species cards (with care info)
│  ├─ Before/after metrics comparison
│  └─ Actions: Report / Quote / Visualise
│
└─ [View Before/After] → BEFORE/AFTER VISUALIZATION SCREEN
       │
       │  Thermal imaging comparison
       │  AI-generated photorealistic render
       │  (POST /api/generate-runware-visual or /api/generate-garden-visual)
       │
       └─ [Get Quote] → INSTALL SCREEN
```

---

### 4.7 Installer Quote Workflow

```
INSTALL SCREEN
│
│  User fills:
│  ├─ Scope notes
│  ├─ Preferred timeline
│  └─ Contact confirmation
│
│  POST /api/installers/request-quote
│  {projectId, candidateSnapshot, recommendationSessionId, notes}
│       ↓
│  InstallerQuoteRequest created in DB
│       ↓
│  POST /api/installers/assign
│  System finds nearest qualified installer
│
└─ INSTALL SUCCESS SCREEN
        ↓

[INSTALLER SIDE — Separate Workflow]
│
├─ Installer receives job notification
├─ POST /api/installers/accept-job
├─ POST /api/installers/submit-quote
│    {quoteAmountInr, estimatedTimelineDays, includedScope, proposedSpecies}
├─ User accepts quote
├─ POST /api/installers/update-job-status  (in_progress → completed)
└─ POST /api/installers/submit-verified-install
     + POST /api/installers/submit-outcome-verification
```

---

### 4.8 Impact Tracking (Post-Install)

```
HOME DASHBOARD → [Impact tab]
│
│  IMPACT DASHBOARD SCREEN
│  (Unlocks after first Completed/Installed project)
│
│  Currently: COMING SOON
│
│  Planned metrics:
│  ├─ CO₂ Offset (kg this year)
│  ├─ Surface cooling (°C reduction)
│  ├─ Water conserved (kL vs concrete)
│  ├─ Species count planted
│  ├─ 6-month progress chart
│  └─ City contribution rank
│
│  Data source:
│  ├─ LongitudinalFollowupSchedule
│  ├─ LongitudinalRemeasurement
│  └─ InstallOutcomeRecord

CARBON DASHBOARD
│
│  POST /api/commercial/log-revenue-event
│  Carbon footprint calculator:
│  └─ calcAnnualFootprint(profile) → {total T/yr, breakdown}
```

---

## 5. ALL 24 SCREENS — NAVIGATION MAP

```
                         ┌─────────┐
                         │ SPLASH  │
                         └────┬────┘
                              ↓
                       ┌─────────────┐
                       │ ONBOARDING  │
                       └──────┬──────┘
                     ┌────────┴────────┐
                     ↓                 ↓
              ┌──────────┐    ┌─────────────────┐
              │   HOME   │    │  PROFILE SETUP  │
              └────┬─────┘    └────────┬────────┘
                   │←──────────────────┘
    ┌──────────────┼──────────────────────────────────────┐
    ↓              ↓              ↓           ↓           ↓
 CREATE         SAVED          CITY       IMPACT      SETTINGS
    │              │            HEAT          │
    ↓              │              │           │
 MEASURE        [Resume]     SPECIES       CARBON
    │              │            LIB         SETUP
  ┌─┴─┐            ↓              │            ↓
  ↓   ↓        [result/          ↓         CARBON
LIVE  PHOTO    layout/      SPECIES       DASHBOARD
 AR  CAPTURE   report]      DETAIL
  │     │
  ↓     ↓
  └──┬──┘
     ↓
ENVIRONMENT
     ↓
ANALYSIS
     ↓
GARDEN LAYOUT ──→ REPORT
     │                ↑
     ↓                │
  RESULT ─────────────┤
     │                │
     ↓                │
BEFORE/AFTER ─────────┘
     │
     ↓
  INSTALL
     ↓
INSTALL SUCCESS
```

---

## 6. PLATFORM & TECH STACK

```
┌─────────────────────────────────────────────────────────────────┐
│                     HEATWISE TECH STACK                         │
├──────────────────┬──────────────────────────────────────────────┤
│  MOBILE SHELL    │  Capacitor (Android WebView)                 │
│  WEB FRAMEWORK   │  Next.js 16 (Pages Router)                   │
│  UI              │  React JSX + inline styles                   │
│  DATABASE        │  Prisma + SQLite (dev) / Postgres (prod)     │
│  AUTH            │  NextAuth + Phone OTP (SMS)                  │
│  ML              │  Python subprocess (species scoring)         │
│  AR              │  WebRTC camera + projective geometry math    │
│  VISUALISATION   │  Three.js / WebGL canvas                     │
│  AI IMAGES       │  Runware API (photorealistic renders)        │
│  WEATHER DATA    │  Open-Meteo (free, no API key)              │
│  GEOCODING       │  Nominatim + Open-Meteo geocoding           │
└──────────────────┴──────────────────────────────────────────────┘
```

---

## 7. AR MEASUREMENT — HOW IT WORKS

**Platform:** Not ARKit / ARCore / Unity.
Built on **Web APIs inside a Capacitor WebView**:

```
INPUT: Camera feed via WebRTC getUserMedia()
SENSOR: DeviceOrientationEvent (tilt angle)
RENDER: WebGL canvas overlay (Three.js)

MEASUREMENT ALGORITHM:
┌──────────────────────────────────────────────┐
│  1. User taps 4 corners on camera feed       │
│     (tl, tr, br, bl) in screen pixels        │
│                                              │
│  2. Validate quadrilateral                   │
│     • Convexity check (cross products)       │
│     • Min area > 1000 px²                    │
│     • No points too close (<20px)            │
│                                              │
│  3. Perspective rectification                │
│     widthPx  = (topEdge + bottomEdge) / 2   │
│     lengthPx = (leftEdge + rightEdge) / 2   │
│                                              │
│  4. Metric scale from FOV + tilt             │
│     d = cameraHeight / cos(tiltAngle)        │
│     visW = 2 × d × tan(hFOV / 2)            │
│     scale = visW / imageWidth                │
│                                              │
│  5. Real-world output                        │
│     widthM  = widthPx  × scale (±15%)       │
│     lengthM = lengthPx × scale (±15%)       │
│     areaSqM via shoelace formula             │
└──────────────────────────────────────────────┘

FOV estimation: MediaStreamTrack.getSettings()
  → focusDistance available: use trigonometry
  → fallback: aspect ratio heuristic (58–72°)

Accuracy: ~±15%  (sufficient for plant planning;
         installer corrects final spec on-site)

Confidence scoring:
  trackingQuality × pointCount × updateCount
  − penalty for self-crossing polygon
  → High / Medium / Low
```

---

## 8. RECOMMENDATION ENGINE

```
INPUT: {widthM, lengthM, spaceType, sunExposure, windLevel,
        budgetRange, maintenanceLevel, primaryGoal, floorLevel}

PIPELINE:
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  POST /api/recommendations/generate                         │
│         ↓                                                   │
│  orchestrateLayoutRecommendations.ts                        │
│         ↓                                                   │
│  layoutEligibility.ts  ← filters ineligible species        │
│         ↓                                                   │
│  ┌──────────────────────────────────────────┐               │
│  │  Strategy 1: ML Model (Python process)   │               │
│  │  ml/registry/ — trained species scorer   │               │
│  │  mergeMlIntoLayoutRecommendations.ts     │               │
│  └──────────────┬───────────────────────────┘               │
│                 │ (fails / low confidence)                  │
│  ┌──────────────▼───────────────────────────┐               │
│  │  Strategy 2: Catalog Hybrid Fallback     │               │
│  │  catalogHybridFallback.ts (37KB)         │               │
│  │  Rules + SpeciesCatalog DB lookup        │               │
│  └──────────────┬───────────────────────────┘               │
│                 │ (still fails)                             │
│  ┌──────────────▼───────────────────────────┐               │
│  │  Strategy 3: Rules-only Fallback         │               │
│  │  rulesOnlyFallback.ts                    │               │
│  └──────────────┬───────────────────────────┘               │
│                 ↓                                           │
│  OUTPUT: {scoredPlants[], heatReductionSummary,             │
│           layoutSchema, confidence, telemetryMeta}          │
│                                                             │
│  Telemetry (immutable, append-only):                        │
│  RecommendationTelemetrySession → impressions/interactions  │
│  RecommendationCandidateSnapshot → exact card shown         │
│  RecommendationTelemetryEvent → user signals                │
│  RecommendationRuntimeObservation → rollout metrics         │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. DATA MODEL (Core)

```
User ──────────────────────────────── 1:N ── Project
                                              │
                                          1:N │
                                         PhotoSession
                                              │
                              ┌───────────────┼───────────────────┐
                              ↓               ↓                   ↓
                   EnvironmentSnapshot   RecommendationRun   InstallerQuoteRequest
                                              │                   │
                                              ↓                   ↓
                                   RecommendationTelemetry   InstallerQuoteAssignment
                                   Session                        │
                                              │                   ↓
                                              ↓             InstallerQuote
                                   SpeciesCatalog                 │
                                   (51 species, ML tags)          ↓
                                                          InstallerInstallJob
                                                                   │
                                                                   ↓
                                                        VerifiedInstallRecord
                                                                   │
                                                                   ↓
                                                        InstallOutcomeRecord
                                                                   │
                                                                   ↓
                                                          ImpactDashboard
```

---

## 10. BOTTOM NAVIGATION TABS

```
┌──────┬──────┬──────┬────────┬──────────┐
│ Home │Explore│ SCAN │ Impact │ Settings │
│  🏠  │  🌐  │  ⬜  │   🌿   │   ⚙️    │
│      │      │(fab) │        │          │
└──────┴──────┴──────┴────────┴──────────┘
     ↓        ↓      ↓        ↓         ↓
  home    cityHeat create   impact   settings
```

---

## 11. KEY METRICS & CONFIDENCE

| Metric | Calculation | Source |
|--------|-------------|--------|
| Surface temp drop | estimatedDropC (ML/rules) | Recommendation engine |
| CO₂ offset | areaSqM × 0.021 T/yr | Fixed coefficient |
| Green coverage | scoredPlants coverage sum | Plant placement algo |
| Urban heat island | (currentTemp − 18) × 0.15 | Open-Meteo live data |
| Cooling potential | −1.6 / −2.8 / −4.2°C tiers | Temp threshold rules |
| Water conserved | areaSqM × factor | Estimation model |
| Impact confidence | tracking quality × stability | AR session metadata |

---

## 12. MENTOR NOTES — HONEST LIMITATIONS

| Area | Current State | Upgrade Path |
|------|--------------|--------------|
| AR depth | Monocular only (±15% accuracy) | ARCore Depth API via Capacitor plugin |
| AR plane detection | None — user taps corners manually | ARCore hit-testing / plane detection |
| ML model | Python subprocess, offline registry | Cloud inference endpoint |
| Impact tracking | Coming Soon (no real sensor data) | IoT sensor integration |
| Photo visualisation | Runware API (AI renders) | On-device diffusion model |
| Species catalog | 51 species hardcoded | Dynamic DB with regional availability |

---

*Document generated: April 2026 · HeatWise v2.1.0*
