# HeatWise — User Flow Document
**Version:** 2.1  |  **Date:** March 2026  |  **Status:** Production-ready demo

---

## 1. Product Overview

HeatWise is an AI-powered urban rooftop greening platform for Indian cities. It helps homeowners, housing societies, and commercial property managers:
- Measure their rooftop or balcony using AR/camera
- Receive an AI-generated green installation plan (plants + layout)
- Understand the predicted cooling, CO₂, and water savings
- Request a quote from certified local installers

---

## 2. User Personas

| Persona | Description | Primary Goal |
|---|---|---|
| **Urban Homeowner** | Flat/villa owner, 28–55 yrs, concerned about heat | Reduce cooling bills, make roof usable |
| **Housing Society Mgr** | Manages 50–500 unit complex | Large-scale green roof ROI |
| **Commercial FM** | Facility manager for office/retail | Compliance, ESG reporting |
| **Installer Partner** | Certified green-roof contractor | Receive qualified leads and quotes |

---

## 3. End-to-End User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    HEATWISE USER JOURNEY                        │
└─────────────────────────────────────────────────────────────────┘

  [Download / Open App]
         │
         ▼
  ┌─────────────┐
  │   SPLASH    │  Boot animation + brand intro (2.5s)
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  ONBOARDING │  3-slide carousel: What HeatWise does
  │   SLIDES    │  (skippable on 2nd+ launch)
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  PHONE AUTH │  Enter mobile number → OTP sent via SMS
  │  (Sign In)  │  ──► Dev mode: OTP shown on screen
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │   PROFILE   │  Name, city, gardening interest (1-time)
  │  COMPLETE   │  Skippable, can finish later
  └──────┬──────┘
         │
         ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                    HOME DASHBOARD                            │
  │  • City Cooling Index score (animated)                       │
  │  • Quick metrics: area scanned, temp drop, CO₂, energy      │
  │  • Recent projects list (from DB)                            │
  │  • CTA: "Start New Scan"                                     │
  └──────┬──────────────────────────────────────────────────────┘
         │
         │  [Start New Scan]
         ▼
  ┌─────────────┐
  │   SCAN /    │  Choose scan method:
  │  MEASURE    │  A) Live AR measurement (WebGL camera)
  │   SCREEN    │  B) Manual input (length × width)
  │             │  Calculates area in m² in real time
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  PROJECT    │  Name, location, surface type, primary goal
  │  DETAILS    │  Budget range, floor level, load capacity
  │   FORM      │  Space type: balcony / terrace / rooftop
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │ ENVIRONMENT │  Sun exposure, water availability, wind level
  │  SETTINGS   │  Region (auto-populated via geospatial API)
  │             │  Maintenance preference, special needs (pet-safe)
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  AI ANALYSIS│  POST /api/recommendations/generate
  │  (loading)  │  • ML model scoring (Python serving)
  │  NeuralBrain│  • Catalog hybrid fallback
  │   3D anim   │  • Rules-only fallback (always available)
  └──────┬──────┘
         │
         ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                     RESULT SCREEN                            │
  │  • 3D Garden Model (Three.js) — species placed on roof       │
  │  • Metrics: Green Area / Water/Day / Species / Energy saving  │
  │  • Filterable species cards (Sun / Wind / Cooling filters)    │
  │  • CO₂ projection chart (3-year)                             │
  │  • Confidence level from ML model                            │
  │  CTAs:  [Generate AI Visual] [Request Quote] [Full Report]   │
  └──────┬──────────────────────────────────────────────────────┘
         │
         ├──────────────────────────┐
         │                          │
         ▼                          ▼
  ┌─────────────┐           ┌───────────────┐
  │  BEFORE /   │           │  FULL REPORT  │
  │   AFTER     │           │   SCREEN      │
  │ AI VISUAL   │           │ Tabs: THERMAL │
  │ (OpenAI     │           │ SPECIES IMPACT│
  │  Vision)    │           │               │
  └──────┬──────┘           └───────┬───────┘
         │                          │
         └──────────┬───────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────────────────────────────┐
  │               INSTALLATION QUOTE REQUEST                     │
  │  • Project scope summary (area, cooling, confidence)         │
  │  • Optimal install window (dynamic — next 2 months)          │
  │  • Contact details form (name, email, phone)                  │
  │  • Timeline preference                                        │
  │  • Partner network selection (local certified installers)     │
  │  • POST /api/installers/quote-request                         │
  └──────┬──────────────────────────────────────────────────────┘
         │
         ▼
  ┌─────────────┐
  │  SUCCESS /  │  Confirmation + installer contact promise
  │  DASHBOARD  │  Return to Home → project saved in DB
  └─────────────┘
```

---

## 4. Screen-by-Screen Summary

### 4.1 Splash Screen
- Duration: ~2.5 seconds
- 3D MegaCity animation in background
- HeatWise brand + version
- Auto-advances to Onboarding (first launch) or Home (returning user)

### 4.2 Onboarding (3 slides)
1. **Urban Heat** — Problem statement, city temperature data
2. **Smart Greening** — How AI + AR solves it
3. **Measurable Results** — Cooling, CO₂, water metrics

### 4.3 Phone Auth
- Enter `+91 XXXXXXXXXX` format
- OTP delivered via SMS (dev: displayed on screen)
- 6-digit code entry screen
- Creates User record in DB on first sign-in

### 4.4 Complete Profile
- Name, city selection
- Gardening interest level (1–5)
- One-time screen, skippable

### 4.5 Home Dashboard
- City Cooling Index (0–100, animated count-up)
- 4 key metrics tiles
- Recent project list from `/api/projects`
- Bottom nav: Home / Scan / Report / Settings

### 4.6 Measure Screen
- AR camera mode (Live AR with Three.js overlay)
- Manual mode: L × W inputs → real-time area
- Output: `widthM`, `lengthM` stored in `photoSession`

### 4.7 Environment Screen
- Sun exposure: Full / Partial / Shade
- Water availability: Abundant / Moderate / Scarce
- Wind level: Low / Medium / High
- Maintenance preference: Minimal / Low / Moderate / High

### 4.8 Analysis Screen
- NeuralBrain 3D visualization while processing
- Calls `POST /api/recommendations/generate`
- Shows progress steps: Scanning → Processing → Generating

### 4.9 Result Screen
- **Hero**: 3D garden model with labeled plant species
- **Metrics**: Green Area, Water/Day, Species Count, Energy Saving
- **Species cards**: Filterable by sun / wind / cooling score
- **CO₂ chart**: Year 1 → Year 3 projection
- **Action buttons**: AI Visual / Install Quote / Full Report

### 4.10 Report Screen
Three tabs:
- **Thermal** — Temperature reduction chart, before/after bars
- **Species** — All recommended plants with descriptions, water needs, pet-safety
- **Impact** — CO₂ offset, water conservation, biodiversity score, heat reduction

### 4.11 Install Screen
- Dynamic optimal install window
- Contact form
- Installer network RFQ
- On submit: creates `InstallerQuoteRequest` + `InstallerInstallJob` in DB

---

## 5. Navigation Map

```
                        ┌──────────┐
                        │  SPLASH  │
                        └────┬─────┘
                             │
                    ┌────────▼────────┐
                    │   ONBOARDING    │
                    └────────┬────────┘
                             │
              ┌──────────────▼──────────────┐
              │       PHONE AUTH            │
              │  send-otp → verify-otp      │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │     COMPLETE PROFILE        │
              └──────────────┬──────────────┘
                             │
    ┌────────────────────────▼──────────────────────────┐
    │                  HOME DASHBOARD                    │
    │              (bottom nav: home tab)                │
    └───┬──────────────────┬──────────────────┬──────────┘
        │                  │                  │
   [New Scan]        [My Scans tab]     [Settings tab]
        │
        ▼
   ┌─────────┐    ┌────────────┐    ┌───────────┐
   │ MEASURE ├───►│ ENV SETUP  ├───►│ ANALYSIS  │
   └─────────┘    └────────────┘    └─────┬─────┘
                                          │
                                    ┌─────▼─────┐
                                    │  RESULT   │
                                    └──┬──┬──┬──┘
                                       │  │  │
                              ┌────────┘  │  └──────────┐
                              ▼           ▼             ▼
                         ┌────────┐ ┌────────┐ ┌──────────┐
                         │BEFORE/ │ │ REPORT │ │ INSTALL  │
                         │ AFTER  │ │        │ │  QUOTE   │
                         └────────┘ └────────┘ └──────────┘
```

---

## 6. Data Flow Diagram

```
  USER INPUT                  APP LAYER                  BACKEND / DB
  ──────────                  ─────────                  ────────────

  Phone Number ──────────► /api/phone-auth/send-otp ──► PhoneOtp (DB)
  OTP Code ──────────────► /api/phone-auth/verify-otp ─► User (DB)

  Scan dimensions ──────► photoSession (React state)
  Environment prefs ────► buildRecommendationGenerateRequest()
                               │
                               ▼
                    /api/recommendations/generate
                               │
                  ┌────────────┼────────────────────┐
                  ▼            ▼                    ▼
             Python ML    Catalog Hybrid        Rules-Only
             Serving      Fallback (TS)         Fallback (TS)
                  │            │
                  └────────────┘
                               │
                               ▼
                    ScoredPlants[] + HeatReductionSummary
                               │
                               ▼
                    RecommendationTelemetrySession (DB)
                    RecommendationCandidateSnapshot (DB)
                               │
                               ▼
                         React: ResultScreen
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
             /api/reports/        /api/installers/
             recommendation-      quote-request
             dossier              InstallerQuoteRequest (DB)
                    │
                    ▼
             /api/reports/user-report
             RecommendationDossier (DB)
```

---

## 7. Key User Actions & API Calls

| User Action | API Endpoint | DB Tables Written |
|---|---|---|
| Request OTP | `POST /api/phone-auth/send-otp` | `PhoneOtp` |
| Verify OTP | `POST /api/phone-auth/verify-otp` | `User` |
| Load projects | `GET /api/projects` | — |
| Generate recommendation | `POST /api/recommendations/generate` | `RecommendationRun`, `RecommendationTelemetrySession` |
| View results | — (client-side) | `RecommendationTelemetryEvent` (view) |
| Generate AI visual | `POST /api/generate-garden-visual` | — (OpenAI call) |
| Request quote | `POST /api/installers/quote-request` | `InstallerQuoteRequest` |
| View full report | `POST /api/reports/recommendation-dossier` | `RecommendationDossier` |

---

## 8. Error States & Fallbacks

| Scenario | Fallback Behaviour |
|---|---|
| ML Python process unavailable | Catalog hybrid TypeScript fallback |
| Catalog hybrid fails | Rules-only TypeScript fallback |
| No DB connection | Auth fails gracefully with error message |
| No internet / API offline | "Load failed" with retry button |
| Zero species match filters | Show full unfiltered species list |
| No photo captured | Skip AI visual option (button hidden) |

---

*Document maintained by HeatWise engineering. Update after each sprint.*
