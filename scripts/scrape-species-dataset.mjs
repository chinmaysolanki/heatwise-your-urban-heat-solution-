/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║           HeatWise — Species Dataset Scraper                           ║
 * ║                                                                        ║
 * ║  Sources:                                                              ║
 * ║    • Perenual API   — images, watering, sunlight, pet/human toxicity   ║
 * ║    • GBIF API       — taxonomy, family, hardiness zones                ║
 * ║    • Wikipedia API  — description/notes                                ║
 * ║    • Open Meteo     — climate zone validation                          ║
 * ║    • Wikimedia Commons — fallback CC-licensed images                   ║
 * ║                                                                        ║
 * ║  Outputs (in data/species/scraped/):                                   ║
 * ║    • species_dataset_full.csv    — All fields (DB + ML + image)        ║
 * ║    • species_dataset_ml.csv      — ML CSV format (catalogHybrid)       ║
 * ║    • species_dataset_seed.json   — Drop-in Prisma seed format          ║
 * ║    • species_images/             — Downloaded plant images             ║
 * ║    • scrape_manifest.json        — Per-species confidence + sources    ║
 * ║    • DATASET_FIELDS.md           — Field documentation                 ║
 * ║                                                                        ║
 * ║  Usage:                                                                ║
 * ║    node scripts/scrape-species-dataset.mjs                             ║
 * ║    node scripts/scrape-species-dataset.mjs --species "Aloe vera"       ║
 * ║    node scripts/scrape-species-dataset.mjs --input species_list.txt    ║
 * ║    node scripts/scrape-species-dataset.mjs --no-images --limit 20      ║
 * ║                                                                        ║
 * ║  Env vars (optional):                                                  ║
 * ║    PERENUAL_API_KEY   — https://perenual.com/docs/api (free 100/day)   ║
 * ║    TREFLE_API_TOKEN   — https://trefle.io (free 120/min)               ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { createWriteStream, mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";

const __dir  = dirname(fileURLToPath(import.meta.url));
const ROOT   = join(__dir, "..");
const OUT    = join(ROOT, "data", "species", "scraped");
const IMG    = join(OUT, "species_images");
const CACHE  = join(OUT, ".cache");

mkdirSync(OUT,   { recursive: true });
mkdirSync(IMG,   { recursive: true });
mkdirSync(CACHE, { recursive: true });

// ── CLI args ──────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const argMap  = {};
for (let i = 0; i < args.length; i += 2) argMap[args[i]] = args[i + 1] ?? true;
const SKIP_IMAGES   = "--no-images"   in argMap || false;
const LIMIT         = parseInt(argMap["--limit"] ?? "9999");
const SINGLE_QUERY  = argMap["--species"] ?? null;
const INPUT_FILE    = argMap["--input"]   ?? null;
const PERENUAL_KEY  = process.env.PERENUAL_API_KEY  ?? "";
const TREFLE_TOKEN  = process.env.TREFLE_API_TOKEN  ?? "";

// ── Rate-limit helper ─────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Fetch with retry + caching. cacheKey = stable string for this request. */
async function apiFetch(url, opts = {}, cacheKey = null, retries = 3) {
  if (cacheKey) {
    const cPath = join(CACHE, `${cacheKey.replace(/[^a-z0-9_-]/gi, "_")}.json`);
    if (existsSync(cPath)) {
      try { return JSON.parse(readFileSync(cPath, "utf8")); } catch {}
    }
  }
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(12_000) });
      if (!res.ok) {
        if (res.status === 429) { await sleep(3000 * (attempt + 1)); continue; }
        return null;
      }
      const data = await res.json();
      if (cacheKey) {
        const cPath = join(CACHE, `${cacheKey.replace(/[^a-z0-9_-]/gi, "_")}.json`);
        writeFileSync(cPath, JSON.stringify(data));
      }
      return data;
    } catch (e) {
      if (attempt < retries - 1) await sleep(1500 * (attempt + 1));
    }
  }
  return null;
}

/** Download binary file to disk. */
async function downloadImage(url, destPath) {
  if (!url || SKIP_IMAGES) return false;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok || !res.body) return false;
    await pipeline(res.body, createWriteStream(destPath));
    return true;
  } catch { return false; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCE ADAPTERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Perenual — images, watering, sunlight, toxicity, maintenance, edible */
async function fetchPerenual(name) {
  if (!PERENUAL_KEY) return null;
  const q   = encodeURIComponent(name);
  const url = `https://perenual.com/api/species-list?key=${PERENUAL_KEY}&q=${q}&indoor=0`;
  const data = await apiFetch(url, {}, `perenual_${name}`);
  if (!data?.data?.length) return null;
  const s = data.data[0];
  return {
    perenual_id:           s.id,
    scientific_name_raw:   Array.isArray(s.scientific_name) ? s.scientific_name[0] : s.scientific_name,
    family:                s.family ?? null,
    cycle:                 s.cycle ?? null,               // Annual | Biennial | Perennial | Biannual
    watering:              s.watering ?? null,            // Frequent | Average | Minimum | None
    sunlight:              Array.isArray(s.sunlight) ? s.sunlight : [s.sunlight].filter(Boolean),
    maintenance:           s.maintenance ?? null,         // Low | Moderate | High
    edible:                s.edible ?? false,
    poisonous_to_humans:   s.poisonous_to_humans  ?? false,
    poisonous_to_pets:     s.poisonous_to_pets    ?? false,
    invasive:              s.invasive ?? false,
    indoor:                s.indoor  ?? false,
    care_level:            s.care_level  ?? null,         // Easy | Medium | Hard
    growth_rate:           s.growth_rate ?? null,
    image_url:             s.default_image?.original_url   ?? s.default_image?.regular_url ?? null,
    image_thumb:           s.default_image?.thumbnail      ?? null,
    image_license:         s.default_image?.license_name   ?? null,
  };
}

/** GBIF — taxonomic family, genus, rank, hardiness context */
async function fetchGBIF(scientificName) {
  const q    = encodeURIComponent(scientificName);
  const url  = `https://api.gbif.org/v1/species?name=${q}&limit=1`;
  const data = await apiFetch(url, {}, `gbif_${scientificName}`);
  const r    = data?.results?.[0];
  if (!r) return null;
  return {
    gbif_key:      r.key,
    kingdom:       r.kingdom   ?? null,
    phylum:        r.phylum    ?? null,
    class:         r.class     ?? null,
    order:         r.order     ?? null,
    family:        r.family    ?? null,
    genus:         r.genus     ?? null,
    species:       r.species   ?? null,
    rank:          r.rank      ?? null,
    taxonomic_status: r.taxonomicStatus ?? null,
  };
}

/** Wikipedia — extract plain-text description for notes field */
async function fetchWikipedia(name) {
  const q   = encodeURIComponent(name.replace(/ /g, "_"));
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${q}`;
  const data = await apiFetch(url, { headers: { "User-Agent": "HeatWise-Dataset-Scraper/1.0" } }, `wiki_${name}`);
  if (!data?.extract) return null;
  return {
    wiki_title:       data.title,
    wiki_description: (data.description ?? "").slice(0, 120),
    wiki_extract:     (data.extract     ?? "").slice(0, 500),
    wiki_image:       data.thumbnail?.source ?? null,
  };
}

/** Wikimedia Commons — fallback CC image if Perenual has no key */
async function fetchWikimediaImage(scientificName) {
  const q   = encodeURIComponent(scientificName);
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=images&prop=imageinfo&gimlimit=1&iiprop=url|extmetadata&titles=${q}&format=json&origin=*`;
  const data = await apiFetch(url, {}, `commons_${scientificName}`);
  const pages = data?.query?.pages ?? {};
  const first = Object.values(pages)[0];
  const info  = first?.imageinfo?.[0];
  if (!info?.url) return null;
  const license = info.extmetadata?.LicenseShortName?.value ?? "";
  if (!license.match(/cc|public domain/i)) return null; // CC/PD only
  return { image_url: info.url, image_license: license, image_source: "wikimedia" };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAPPING LAYER  →  HeatWise schema fields
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sunlight array from Perenual → { sunlight_preference, minSunHours, maxSunHours }
 * Perenual values: "full sun", "part shade", "part sun/part shade", "full shade"
 */
function mapSunlight(sunArr = []) {
  const tags = sunArr.map(s => s?.toLowerCase?.() ?? "");
  const hasFullSun   = tags.some(t => t.includes("full sun"));
  const hasPartShade = tags.some(t => t.includes("part"));
  const hasShade     = tags.some(t => t.includes("shade") && !t.includes("part"));

  if (hasFullSun && !hasPartShade) {
    return { sunlight_preference: "FULL",  minSunHours: 6, maxSunHours: 12 };
  }
  if (hasPartShade || (hasFullSun && hasShade)) {
    return { sunlight_preference: "PART",  minSunHours: 3, maxSunHours: 6 };
  }
  if (hasShade) {
    return { sunlight_preference: "SHADE", minSunHours: 0, maxSunHours: 3 };
  }
  return { sunlight_preference: "PART", minSunHours: 3, maxSunHours: 8 }; // default
}

/**
 * Watering string → { water_demand, droughtTolerant, droughtTolerance }
 * Perenual: "Frequent" | "Average" | "Minimum" | "None"
 */
function mapWatering(watering) {
  switch ((watering ?? "").toLowerCase()) {
    case "frequent": return { water_demand: "HIGH", droughtTolerant: false, droughtTolerance: "LOW"  };
    case "average":  return { water_demand: "MED",  droughtTolerant: false, droughtTolerance: "MED"  };
    case "minimum":  return { water_demand: "LOW",  droughtTolerant: true,  droughtTolerance: "HIGH" };
    case "none":     return { water_demand: "LOW",  droughtTolerant: true,  droughtTolerance: "HIGH" };
    default:         return { water_demand: "MED",  droughtTolerant: false, droughtTolerance: "MED"  };
  }
}

/**
 * Maintenance string → { lowMaintenance, maintenance_need }
 * Perenual: "Low" | "Moderate" | "High"
 */
function mapMaintenance(m) {
  const v = (m ?? "").toLowerCase();
  if (v === "low"  ) return { lowMaintenance: true,  maintenance_need: "LOW" };
  if (v === "high" ) return { lowMaintenance: false, maintenance_need: "HIGH"};
  return                    { lowMaintenance: false, maintenance_need: "MED" };
}

/**
 * Derive SpeciesCatalog.category from growth_habit, cycle, sunlight, edibility.
 */
function deriveCategory(perenual, wiki, inputHint) {
  if (inputHint) return inputHint.toUpperCase();
  const habit = (perenual?.growth_rate ?? "").toLowerCase();
  const sci   = (perenual?.scientific_name_raw ?? "").toLowerCase();
  const desc  = (wiki?.wiki_description ?? "").toLowerCase();
  const edible = perenual?.edible ?? false;

  if (sci.match(/cactus|opuntia|cereus|mammillaria|echinopsis/)) return "SUCCULENT";
  if (sci.match(/aloe|agave|haworthia|echeveria|sedum|crassula/)) return "SUCCULENT";
  if (sci.match(/ocimum|mentha|coriandrum|murraya|cymbopogon/)) return edible ? "HERB" : "ORNAMENTAL";
  if (sci.match(/solanum|capsicum|basella|lycopersicon/)) return "VEGETABLE";
  if (sci.match(/ficus|schefflera|monstera|colocasia|caladium/)) return "FOLIAGE";
  if (sci.match(/bougainvillea|ipomoea|passiflora|thunbergia/)) return "CLIMBER";
  if (sci.match(/pennisetum|festuca|bambusa|phyllostachys|pleioblastus/)) return "GRASS";
  if (desc.match(/herb|basil|mint|coriander|culinary/)) return edible ? "HERB" : "ORNAMENTAL";
  if (desc.match(/shrub|bush|hedge/)) return "SHRUB";
  if (desc.match(/vine|climber|creeper|liana/)) return "CLIMBER";
  if (desc.match(/grass|bamboo|reed/)) return "GRASS";
  if (desc.match(/vegetable|tomato|pepper|leafy/)) return "VEGETABLE";
  if (desc.match(/succulent|cactus|xerophyte/)) return "SUCCULENT";
  if (edible) return "VEGETABLE";
  return "ORNAMENTAL";
}

/**
 * Derive climate suitability tokens from watering, sunlight, temp tolerance.
 * Tokens used by catalogHybridFallback: HOT_HUMID | HOT_DRY | HOT_SEMI_ARID |
 *   MONSOON_HEAVY | TROPICAL | SUBTROPICAL | MEDITERRANEAN | TEMPERATE | ALPINE
 */
function deriveClimateSuitability(perenual, wiki) {
  const tokens = new Set();
  const desc    = ((wiki?.wiki_extract ?? "") + " " + (wiki?.wiki_description ?? "")).toLowerCase();
  const water   = (perenual?.watering ?? "").toLowerCase();
  const sun     = (perenual?.sunlight ?? []).map(s => s?.toLowerCase?.() ?? "");
  const edible  = perenual?.edible ?? false;
  const hardy   = water === "minimum" || water === "none";
  const fullSun = sun.some(s => s.includes("full sun"));
  const tropical = desc.match(/tropical|india|southeast asia|south asia|monsoon/);
  const mediterranean = desc.match(/mediterranean|arid|semiarid|semi-arid|drought/);
  const temperate = desc.match(/temperate|europe|north america|cool|cold/);

  if (tropical || desc.match(/humid|rainforest/)) {
    tokens.add("TROPICAL");
    tokens.add("HOT_HUMID");
    if (desc.match(/monsoon|india|bangladesh|sri lanka/)) tokens.add("MONSOON_HEAVY");
  }
  if (mediterranean || hardy) {
    tokens.add("HOT_DRY");
    tokens.add("MEDITERRANEAN");
  }
  if (fullSun && hardy) tokens.add("HOT_SEMI_ARID");
  if (desc.match(/subtropical|warm|florida|texas|australia/)) tokens.add("SUBTROPICAL");
  if (temperate) tokens.add("TEMPERATE");
  if (!tokens.size) { tokens.add("TROPICAL"); tokens.add("HOT_HUMID"); } // safe default
  return [...tokens].join("|");
}

/**
 * Derive cooling_contribution (0.0–3.0).
 * Scoring rationale for the recommendation engine:
 *   3.0 = Max cooling: dense climbers/hedges covering walls (solar block)
 *   2.5 = Dense foliage shrubs, high evapotranspiration (ET) grasses
 *   2.0 = Medium foliage coverage, average ET rate
 *   1.5 = Ground covers, sedums, small herbs
 *   1.0 = Sparse succulents, minimal leaf area
 *   0.5 = Decorative-only, minimal green mass
 */
function deriveCoolingContribution(perenual, category) {
  const cat   = (category ?? "").toUpperCase();
  const water = (perenual?.watering ?? "").toLowerCase();
  const sun   = (perenual?.sunlight ?? []).map(s => s?.toLowerCase?.() ?? "");
  const fullSun = sun.some(s => s.includes("full sun"));
  const highWater = water === "frequent";

  // Climbers / privacy screens — highest wall coverage
  if (cat === "CLIMBER") return 3.0;
  // Dense foliage / large-leaf tropical — high ET + shade
  if (cat === "FOLIAGE" && highWater) return 2.8;
  if (cat === "FOLIAGE") return 2.4;
  // Grasses / bamboo — density + evapotranspiration
  if (cat === "GRASS") return 2.5;
  // Large shrubs with high water + full sun
  if (cat === "SHRUB" && highWater && fullSun) return 2.6;
  if (cat === "SHRUB") return 2.0;
  // Edible vegetables: moderate canopy
  if (cat === "VEGETABLE" && fullSun) return 1.8;
  if (cat === "VEGETABLE") return 1.5;
  // Herbs: modest cooling but aromatic value
  if (cat === "HERB" && highWater) return 1.6;
  if (cat === "HERB") return 1.3;
  // Succulents: low leaf area but reflective
  if (cat === "SUCCULENT") return 0.9;
  // Ornamentals: variable
  if (fullSun && highWater) return 2.0;
  return 1.5;
}

/**
 * Derive privacy_contribution (0.0–3.0).
 */
function derivePrivacyContribution(perenual, category) {
  const cat  = (category ?? "").toUpperCase();
  const rate = (perenual?.growth_rate ?? "").toLowerCase();
  if (cat === "CLIMBER") return 2.8;
  if (cat === "GRASS")   return 2.5;
  if (cat === "SHRUB" && rate === "high") return 2.6;
  if (cat === "SHRUB")   return 1.8;
  if (cat === "FOLIAGE") return 1.6;
  return 0.8;
}

/**
 * Derive pollinator_value (0–3) from flowering, invasive flags, description.
 */
function derivePollinatorValue(perenual, wiki) {
  const flowering = perenual ? (!perenual.edible || perenual.edible) : true; // assume possible
  const desc = ((wiki?.wiki_extract ?? "") + " " + (wiki?.wiki_description ?? "")).toLowerCase();
  let score = 0;
  if (desc.match(/bee|butterfly|pollinator|nectar|attract/)) score += 1.5;
  if (desc.match(/aromatic|fragrant|scented/)) score += 0.5;
  if (perenual?.invasive) score -= 0.5;
  return Math.min(3.0, Math.max(0, parseFloat(score.toFixed(1))));
}

/**
 * Derive container_suitability from growth rate, cycle, root behavior.
 */
function deriveContainerSuitability(perenual, wiki) {
  const desc = ((wiki?.wiki_extract ?? "")).toLowerCase();
  const rate = (perenual?.growth_rate ?? "").toLowerCase();
  const cycle = (perenual?.cycle ?? "").toLowerCase();

  if (desc.match(/invasive root|large tree|deep root|extensive root/)) return "POOR";
  if (rate === "rapid" && !desc.match(/container|pot|planter/)) return "POOR";
  if (desc.match(/container|pot|balcony|rooftop|terrace|planter/)) return "EXCELLENT";
  if (cycle === "annual" || cycle === "biennial") return "GOOD";
  return "GOOD";
}

/**
 * Derive heat-tolerant boolean from description + sunlight.
 */
function deriveHeatTolerant(perenual, wiki) {
  const desc = ((wiki?.wiki_extract ?? "") + " " + (wiki?.wiki_description ?? "")).toLowerCase();
  const sun  = (perenual?.sunlight ?? []).map(s => s?.toLowerCase?.() ?? "");
  if (desc.match(/heat.tolerant|heat.hardy|tropical|hot climate|arid|semi.arid|drought/)) return true;
  if (sun.some(s => s.includes("full sun")) && !desc.match(/cool|cold|shade|temperate/)) return true;
  return false;
}

/**
 * Derive native_support (LOW | HIGH) — supporting native ecosystem.
 */
function deriveNativeSupport(wiki) {
  const desc = ((wiki?.wiki_extract ?? "")).toLowerCase();
  if (desc.match(/native to|indigenous|endemic/)) return "HIGH";
  if (desc.match(/invasive|introduced|exotic|non.native|naturalized/)) return "LOW";
  return "LOW";
}

/**
 * Derive root_aggressiveness (LOW | MED | HIGH).
 */
function deriveRootAggressiveness(perenual, wiki) {
  const desc  = ((wiki?.wiki_extract ?? "")).toLowerCase();
  const rate  = (perenual?.growth_rate ?? "").toLowerCase();
  const invasive = perenual?.invasive ?? false;
  if (invasive || desc.match(/invasive|aggressive root|stolons|spread rapidly/)) return "HIGH";
  if (rate === "rapid") return "MED";
  return "LOW";
}

/**
 * Derive growth_habit string for the ML CSV column.
 */
function deriveGrowthHabit(perenual, category) {
  const cat = (category ?? "").toUpperCase();
  const desc = ((perenual?.scientific_name_raw ?? "")).toLowerCase();
  if (cat === "CLIMBER")   return "CLIMBER";
  if (cat === "GRASS")     return "GRASS";
  if (cat === "SUCCULENT") return "SUCCULENT";
  if (cat === "HERB")      return "HERB";
  if (cat === "VEGETABLE") return "VEGETABLE";
  if (cat === "FOLIAGE")   return "FOLIAGE";
  if (cat === "SHRUB")     return "SHRUB";
  return "ORNAMENTAL";
}

/**
 * Derive HeatWise tagsJson from all sources.
 */
function deriveTags(perenual, wiki, category, sunMap, waterMap) {
  const tags = new Set();
  const desc = ((wiki?.wiki_extract ?? "") + " " + (wiki?.wiki_description ?? "")).toLowerCase();

  if (waterMap.water_demand === "LOW" && waterMap.droughtTolerant) tags.add("drought");
  if (sunMap.sunlight_preference === "FULL")  tags.add("full_sun");
  if (sunMap.sunlight_preference === "SHADE") tags.add("shade_ok");
  if (perenual?.edible)   tags.add("edible");
  if (perenual?.indoor)   tags.add("indoor_ok");
  if (perenual?.invasive) tags.add("invasive_risk");
  if (category === "CLIMBER")  { tags.add("climber"); tags.add("wall_coverage"); }
  if (category === "GRASS")    tags.add("privacy_screen");
  if (category === "SUCCULENT") tags.add("succulent");
  if (desc.match(/medicinal|ayurved|herbal/)) tags.add("medicinal");
  if (desc.match(/aromatic|fragrant|scent/)) tags.add("aromatic");
  if (desc.match(/monsoon|india|tropical/))  tags.add("monsoon_ok");
  if (desc.match(/container|pot|planter/))   tags.add("container");
  if (desc.match(/native/))                  tags.add("native_adapted");
  if (desc.match(/pollinator|bee|butterfly/)) tags.add("pollinator");
  if (desc.match(/wind.resistant|wind.tolerant/)) tags.add("wind_ok");
  if (desc.match(/green roof|rooftop garden/)) tags.add("green_roof");

  return JSON.stringify([...tags]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MERGE → FULL RECORD
// ═══════════════════════════════════════════════════════════════════════════════

function buildRecord(seedRow, perenual, gbif, wiki) {
  const sunMap     = mapSunlight(perenual?.sunlight ?? []);
  const waterMap   = mapWatering(perenual?.watering);
  const maintMap   = mapMaintenance(perenual?.maintenance);
  const category   = deriveCategory(perenual, wiki, seedRow.category);

  // Prefer seed booleans (curated) over derived where seed is authoritative
  const petSafe       = seedRow.petSafe       ?? !(perenual?.poisonous_to_pets    ?? false);
  const droughtTol    = seedRow.droughtTolerant ?? waterMap.droughtTolerant;
  const heatTol       = seedRow.heatTolerant    ?? deriveHeatTolerant(perenual, wiki);
  const lowMaint      = seedRow.lowMaintenance  ?? maintMap.lowMaintenance;
  const edible        = seedRow.edible          ?? perenual?.edible ?? false;
  const flowering     = seedRow.flowering       ?? false;
  const minSunHours   = seedRow.minSunHours     ?? sunMap.minSunHours;
  const maxSunHours   = seedRow.maxSunHours     ?? sunMap.maxSunHours;

  const chilePetSafe =
    (perenual?.poisonous_to_pets ?? false) || !petSafe
      ? "UNSAFE"
      : (seedRow.tagsJson ?? "").includes("caution") ? "CAUTION" : "SAFE";

  const cooling  = deriveCoolingContribution(perenual, category);
  const privacy  = derivePrivacyContribution(perenual, category);
  const pollinator = derivePollinatorValue(perenual, wiki);
  const climate  = deriveClimateSuitability(perenual, wiki);
  const container = deriveContainerSuitability(perenual, wiki);
  const nativeSup = deriveNativeSupport(wiki);
  const rootAgg  = deriveRootAggressiveness(perenual, wiki);
  const growthHabit = deriveGrowthHabit(perenual, category);

  const tagsJson = seedRow.tagsJson
    ?? deriveTags(perenual, wiki, category, sunMap, waterMap);

  // Notes — prefer seed, enrich with Wikipedia
  const wikiNote  = wiki?.wiki_description ? `(${wiki.wiki_description})` : "";
  const wikiParts = [perenual ? null : wikiNote, wiki?.wiki_extract?.slice(0, 200)].filter(Boolean).join(" ");
  const notes     = seedRow.notes ?? (wikiParts || null);

  // Image — prefer Perenual (high quality), fallback wiki
  const imageUrl   = perenual?.image_url   ?? wiki?.wiki_image    ?? null;
  const imageThumb = perenual?.image_thumb ?? wiki?.wiki_image    ?? null;
  const imageLic   = perenual?.image_license ?? "CC";
  const imageSrc   = perenual?.image_url ? "perenual" : wiki?.wiki_image ? "wikipedia" : null;

  // Source confidence score 0–1
  let confidence = 0;
  if (perenual)                confidence += 0.5;
  if (gbif)                    confidence += 0.2;
  if (wiki?.wiki_extract)      confidence += 0.2;
  if (seedRow.scientificName)  confidence += 0.1;

  return {
    // ── Identity ─────────────────────────────────────────────────────────────
    code:              seedRow.code,
    display_name:      seedRow.displayName,
    scientific_name:   seedRow.scientificName ?? perenual?.scientific_name_raw ?? gbif?.species ?? "",
    family:            gbif?.family ?? perenual?.family ?? "",
    genus:             gbif?.genus  ?? "",
    kingdom:           gbif?.kingdom ?? "Plantae",
    category:          category,
    growth_habit:      growthHabit,
    cycle:             perenual?.cycle ?? "Perennial",
    native_range_notes: (wiki?.wiki_description ?? "").slice(0, 200),
    invasive_risk:     perenual?.invasive ? "HIGH" : "LOW",
    hardiness_zone_min: null,   // requires Trefle token — left for enrichment
    hardiness_zone_max: null,
    max_height_cm:     null,    // requires Trefle token — left for enrichment

    // ── DB Boolean Traits (SpeciesCatalog) ────────────────────────────────────
    edible:            edible,
    flowering:         flowering,
    pet_safe:          petSafe,
    drought_tolerant:  droughtTol,
    heat_tolerant:     heatTol,
    low_maintenance:   lowMaint,

    // ── Sun hours (SpeciesCatalog) ────────────────────────────────────────────
    min_sun_hours:     minSunHours,
    max_sun_hours:     maxSunHours,

    // ── Drought tolerance vocabulary (SpeciesCatalog legacy) ─────────────────
    drought_tolerance: waterMap.droughtTolerance,

    // ── ML CSV Features (catalogHybridFallback) ───────────────────────────────
    climate_suitability:   climate,
    sunlight_preference:   sunMap.sunlight_preference,
    water_demand:          waterMap.water_demand,
    maintenance_need:      maintMap.maintenance_need,
    root_aggressiveness:   rootAgg,
    pollinator_value:      pollinator,
    child_pet_safety:      chilePetSafe,
    native_support:        nativeSup,
    container_suitability: container,
    cooling_contribution:  cooling,
    privacy_contribution:  privacy,

    // ── Tags (SpeciesCatalog) ─────────────────────────────────────────────────
    tags_json:         tagsJson,

    // ── Notes ─────────────────────────────────────────────────────────────────
    notes:             notes ?? "",

    // ── Image ─────────────────────────────────────────────────────────────────
    image_url:         imageUrl  ?? "",
    image_thumbnail:   imageThumb ?? "",
    image_license:     imageLic,
    image_source:      imageSrc ?? "",
    image_local_path:  "",        // filled in after download

    // ── ML weight (used by scoring) ────────────────────────────────────────────
    ml_weight:         1.0,       // default; tune per-species after training

    // ── Active flag ───────────────────────────────────────────────────────────
    active:            true,

    // ── Provenance ────────────────────────────────────────────────────────────
    source_perenual:   perenual ? "yes" : "no",
    source_gbif:       gbif     ? "yes" : "no",
    source_wikipedia:  wiki     ? "yes" : "no",
    source_seed:       "yes",
    confidence:        parseFloat(confidence.toFixed(2)),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSV SERIALISER
// ═══════════════════════════════════════════════════════════════════════════════

/** All columns in species_dataset_full.csv — in this exact order */
const FULL_COLUMNS = [
  // Identity
  "code","display_name","scientific_name","family","genus","kingdom",
  "category","growth_habit","cycle","native_range_notes","invasive_risk",
  "hardiness_zone_min","hardiness_zone_max","max_height_cm",
  // DB boolean traits
  "edible","flowering","pet_safe","drought_tolerant","heat_tolerant","low_maintenance",
  // Sun
  "min_sun_hours","max_sun_hours",
  // Legacy vocab
  "drought_tolerance",
  // ML features
  "climate_suitability","sunlight_preference","water_demand","maintenance_need",
  "root_aggressiveness","pollinator_value","child_pet_safety","native_support",
  "container_suitability","cooling_contribution","privacy_contribution",
  // Tags + notes
  "tags_json","notes",
  // Image
  "image_url","image_thumbnail","image_license","image_source","image_local_path",
  // ML + active
  "ml_weight","active",
  // Provenance
  "source_perenual","source_gbif","source_wikipedia","source_seed","confidence",
];

/** Columns in species_dataset_ml.csv (matches catalogHybridFallback expectation) */
const ML_COLUMNS = [
  "species_key","species_name","climate_suitability","sunlight_preference",
  "water_demand","maintenance_need","root_aggressiveness","pollinator_value",
  "edible","child_pet_safety","native_support","container_suitability",
  "cooling_contribution","privacy_contribution","growth_habit",
];

function csvEscape(val) {
  const s = val === null || val === undefined ? "" : String(val);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCSVRow(rec, columns) {
  return columns.map(col => csvEscape(rec[col] ?? "")).join(",");
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIELD DOCUMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

const FIELD_DOCS = `# HeatWise Species Dataset — Field Reference

Generated: ${new Date().toISOString()}
Format: UTF-8 CSV (species_dataset_full.csv) + ML CSV (species_dataset_ml.csv) + JSON seed

---

## Column Groups

### A — IDENTITY FIELDS

| Column | Type | Source | Description |
|--------|------|--------|-------------|
| code | string | seed | Canonical identifier used across DB, ML models, and app (e.g. \`tulsi_holy\`). Snake-case, unique. |
| display_name | string | seed | User-facing plant name (e.g. "Holy basil (Tulsi)"). |
| scientific_name | string | seed / GBIF | Binomial or genus-level name (e.g. "Ocimum tenuiflorum"). |
| family | string | GBIF / Perenual | Taxonomic family (e.g. "Lamiaceae"). |
| genus | string | GBIF | Taxonomic genus. |
| kingdom | string | GBIF | Always "Plantae". |
| category | string (enum) | derived | \`HERB | VEGETABLE | SUCCULENT | ORNAMENTAL | FOLIAGE | GRASS | CLIMBER | SHRUB\`. |
| growth_habit | string | derived | Mirrors category for ML CSV column. |
| cycle | string | Perenual | Annual / Biennial / Perennial / Biannual. |
| native_range_notes | string | Wikipedia | Short native range description (≤200 chars). |
| invasive_risk | string | Perenual | HIGH / LOW — whether listed as invasive by Perenual. |
| hardiness_zone_min | int? | Trefle (not yet) | Minimum USDA hardiness zone. Null until Trefle token provided. |
| hardiness_zone_max | int? | Trefle (not yet) | Maximum USDA hardiness zone. |
| max_height_cm | float? | Trefle (not yet) | Maximum expected height in cm. |

---

### B — DB BOOLEAN TRAITS  (maps to SpeciesCatalog Prisma model)

These drive hard-exclusion filters in the recommendation engine.

| Column | Type | Source | Recommendation Engine Role |
|--------|------|--------|---------------------------|
| edible | bool | seed / Perenual | \`edibleDominanceTopOpen\` — enforces edible-herb ratios in scenarios |
| flowering | bool | seed / derived | \`showyFullSunOrnamental\` — demotes showy non-cooling ornamentals in scarce-water setups |
| pet_safe | bool | seed / Perenual | \`HARD_PET_UNSAFE_SPECIES\` — hard-excludes if \`child_pet_safe_required=1\` in scenario |
| drought_tolerant | bool | seed / derived | \`waterScarcityHardExclude\` — hard-excludes MED/unknown demand plants unless this is true |
| heat_tolerant | bool | seed / derived | \`shadeSunMismatchHardExclude\` — prevents shade-loving plants on full-sun sites |
| low_maintenance | bool | seed / Perenual | \`maintenanceNudge\` — boosts low-maintenance plants in low-skill scenarios |

---

### C — SUN HOUR FIELDS  (maps to SpeciesCatalog)

| Column | Type | Source | Description |
|--------|------|--------|-------------|
| min_sun_hours | int | seed / Perenual | Minimum direct sun hours tolerated in containers on a roof. Used in \`effectiveSunlightPrefNorm()\`. |
| max_sun_hours | int | seed / Perenual | Maximum direct sun hours tolerated. |
| sunlight_preference | string | Perenual | \`FULL | PART | SHADE\` — reconciled preference label. Used in \`sunMatch()\`. |

---

### D — ML FEATURE FIELDS  (maps to species_features.csv for catalogHybridFallback)

| Column | Type | Values | Scoring Function |
|--------|------|--------|-----------------|
| climate_suitability | string | Pipe-delimited tokens: \`HOT_HUMID|HOT_DRY|HOT_SEMI_ARID|MONSOON_HEAVY|TROPICAL|SUBTROPICAL|MEDITERRANEAN|TEMPERATE\` | Climate match scoring |
| water_demand | string | \`LOW|MED|HIGH\` | \`effectiveWaterDemandNorm()\`, \`waterScarcityHardExclude()\`, \`scarceWaterPriorityFactor()\` |
| maintenance_need | string | \`LOW|MED|HIGH\` | Maintenance scoring nudge |
| root_aggressiveness | string | \`LOW|MED|HIGH\` | Container suitability filter |
| pollinator_value | float | 0.0–3.0 | Ecosystem benefit scoring |
| child_pet_safety | string | \`SAFE|CAUTION|UNSAFE\` | Pet-safe scenario filter (reconciled with pet_safe bool) |
| native_support | string | \`LOW|HIGH\` | Ecological scoring bonus |
| container_suitability | string | \`POOR|GOOD|EXCELLENT\` | Rooftop/balcony eligibility filter |
| cooling_contribution | float | 0.0–3.0 | Primary scoring signal — heat reduction potential |
| privacy_contribution | float | 0.0–3.0 | Privacy benefit scoring |
| drought_tolerance | string | \`LOW|MED|HIGH\` | Legacy vocab field — mirrors drought_tolerant bool |

---

### E — COOLING CONTRIBUTION SCORING GUIDE

| Score | Meaning | Typical Plants |
|-------|---------|---------------|
| 3.0 | Maximum cooling — dense wall coverage | Climbers (Bougainvillea, Money plant, Thunbergia) |
| 2.8 | Excellent — high ET + large canopy | Tropical foliage with high watering |
| 2.5 | Very good — grass density or shrub coverage | Lemongrass, Bamboo, dense Shrubs |
| 2.0 | Good — moderate foliage + partial shade | Hibiscus, Ornamentals with full sun |
| 1.5 | Moderate — herbs, small edibles | Vegetables, most herbs |
| 0.9 | Low — sparse leaf area | Succulents, Cacti |
| 0.5 | Minimal — decorative only | Flowering bulbs |

---

### F — IMAGE FIELDS

| Column | Description |
|--------|-------------|
| image_url | Full-resolution image URL (Perenual preferred, Wikimedia fallback) |
| image_thumbnail | Thumbnail URL for app display |
| image_license | License string (e.g. "CC BY-SA 4.0") |
| image_source | Origin: \`perenual | wikipedia | wikimedia\` |
| image_local_path | Relative path to downloaded image in species_images/ |

---

### G — PROVENANCE FIELDS

| Column | Description |
|--------|-------------|
| source_perenual | yes/no — data fetched from Perenual API |
| source_gbif | yes/no — taxonomy confirmed via GBIF |
| source_wikipedia | yes/no — description pulled from Wikipedia |
| source_seed | yes/no — present in curated HeatWise seed (always "yes") |
| confidence | 0.0–1.0 — how many sources corroborated this record |

---

## Selection Parameters — How Species Are Chosen for Recommendations

The recommendation engine applies these parameters as filters in order:

1. **Hard Exclusion — Sun Mismatch** (\`shadeSunMismatchHardExclude\`)
   - Exclude if \`sunlight_preference = FULL\` and site sun_hours < 2
   - Exclude if \`min_sun_hours > site_sun_hours + 0.75\`

2. **Hard Exclusion — Water Scarcity** (\`waterScarcityHardExclude\`)
   - Exclude \`water_demand = HIGH\` unconditionally when \`water_availability = scarce\`
   - Exclude \`water_demand = MED\` unless \`drought_tolerant = true\`
   - Exclude unknown demand unless \`drought_tolerant = true\`

3. **Hard Exclusion — Pet Safety** (\`HARD_PET_UNSAFE_SPECIES\`)
   - Exclude all species where \`pet_safe = false\` when scenario has \`child_pet_safe_required = 1\`

4. **Container Suitability Filter**
   - Exclude \`container_suitability = POOR\` on rooftop/balcony space types

5. **Priority Boosts / Demotions** (\`scarceWaterPriorityFactor\`)
   - \`water_demand = LOW\` + \`drought_tolerant = true\` → **1.30×** boost
   - \`water_demand = LOW\` alone → **1.12×** boost
   - \`water_demand = MED\` + \`drought_tolerant = true\` → **0.90×** demotion
   - Showy ornamental (non-edible + flowering + full-sun + \`pollinator_value ≥ 3\`) → **0.58×** demotion in scarce-water

6. **Scoring** — weighted sum:
   - \`cooling_contribution\` × cooling weight
   - \`sunMatch(sunlight_preference, site_bucket)\` × sun weight
   - \`pollinator_value\` × ecosystem weight
   - \`container_suitability\` bonus
   - \`ml_weight\` multiplier (per-species model output)

---

*Dataset generated by HeatWise species scraper — scripts/scrape-species-dataset.mjs*
`;

// ═══════════════════════════════════════════════════════════════════════════════
// SPECIES INPUT LIST (seed + extensible)
// ═══════════════════════════════════════════════════════════════════════════════

/** Load the existing seed to use as the base species list */
async function loadSeedList() {
  const seedPath = join(ROOT, "prisma", "data", "species_catalog_seed.mjs");
  if (!existsSync(seedPath)) return [];
  const raw  = readFileSync(seedPath, "utf8");
  // Safe eval: extract the array literal with regex, then eval in isolation
  const match = raw.match(/export const SPECIES_CATALOG_SEED\s*=\s*(\[[\s\S]*?\]);/m);
  if (!match) return [];
  // Use Function constructor to evaluate (safe for local files we control)
  try {
    const fn   = new Function("JSON", `return ${match[1]};`);
    const list = fn(JSON);
    return Array.isArray(list) ? list : [];
  } catch {
    console.warn("  ⚠ Could not parse seed file — using built-in fallback list.");
    return [];
  }
}

// Fallback curated list if seed cannot be parsed
const FALLBACK_SPECIES = [
  { code: "tulsi_holy",       displayName: "Holy basil (Tulsi)",       scientificName: "Ocimum tenuiflorum",       category: "HERB",       edible: true,  flowering: true,  petSafe: true,  droughtTolerant: true,  heatTolerant: true,  lowMaintenance: true,  minSunHours: 4,  maxSunHours: 10 },
  { code: "aloe_vera",        displayName: "Aloe vera",                 scientificName: "Aloe barbadensis miller",  category: "SUCCULENT",  edible: false, flowering: true,  petSafe: false, droughtTolerant: true,  heatTolerant: true,  lowMaintenance: true,  minSunHours: 4,  maxSunHours: 10 },
  { code: "money_plant",      displayName: "Money plant (Pothos)",      scientificName: "Epipremnum aureum",        category: "CLIMBER",    edible: false, flowering: false, petSafe: false, droughtTolerant: true,  heatTolerant: true,  lowMaintenance: true,  minSunHours: 1,  maxSunHours: 5  },
  { code: "bougainvillea",    displayName: "Bougainvillea",             scientificName: "Bougainvillea spectabilis",category: "CLIMBER",    edible: false, flowering: true,  petSafe: false, droughtTolerant: true,  heatTolerant: true,  lowMaintenance: true,  minSunHours: 8,  maxSunHours: 12 },
  { code: "lemongrass",       displayName: "Lemongrass",                scientificName: "Cymbopogon citratus",      category: "GRASS",      edible: true,  flowering: false, petSafe: true,  droughtTolerant: false, heatTolerant: true,  lowMaintenance: true,  minSunHours: 6,  maxSunHours: 10 },
  { code: "hibiscus",         displayName: "Chinese hibiscus",          scientificName: "Hibiscus rosa-sinensis",   category: "ORNAMENTAL", edible: false, flowering: true,  petSafe: true,  droughtTolerant: false, heatTolerant: true,  lowMaintenance: false, minSunHours: 6,  maxSunHours: 10 },
  { code: "sedum",            displayName: "Sedum (stonecrop)",         scientificName: "Sedum spurium",            category: "SUCCULENT",  edible: false, flowering: true,  petSafe: true,  droughtTolerant: true,  heatTolerant: true,  lowMaintenance: true,  minSunHours: 6,  maxSunHours: 12 },
  { code: "portulaca",        displayName: "Portulaca (Purslane)",      scientificName: "Portulaca grandiflora",    category: "ORNAMENTAL", edible: true,  flowering: true,  petSafe: true,  droughtTolerant: true,  heatTolerant: true,  lowMaintenance: true,  minSunHours: 6,  maxSunHours: 12 },
  { code: "cherry_tomato",    displayName: "Cherry tomato",             scientificName: "Solanum lycopersicum",     category: "VEGETABLE",  edible: true,  flowering: true,  petSafe: false, droughtTolerant: false, heatTolerant: true,  lowMaintenance: false, minSunHours: 6,  maxSunHours: 10 },
  { code: "spider_plant",     displayName: "Spider plant",              scientificName: "Chlorophytum comosum",     category: "FOLIAGE",    edible: false, flowering: true,  petSafe: true,  droughtTolerant: true,  heatTolerant: false, lowMaintenance: true,  minSunHours: 1,  maxSunHours: 6  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   HeatWise  ·  Species Dataset Scraper          ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  if (!PERENUAL_KEY) {
    console.log("  ⚠  PERENUAL_API_KEY not set — image/care data will be limited.");
    console.log("     Get a free key at https://perenual.com/docs/api\n");
  }

  // Build species list
  let species = await loadSeedList();
  if (!species.length) species = FALLBACK_SPECIES;

  if (SINGLE_QUERY) {
    species = [{ code: SINGLE_QUERY.toLowerCase().replace(/\s+/g, "_"), displayName: SINGLE_QUERY, scientificName: SINGLE_QUERY }];
  }
  if (INPUT_FILE && existsSync(INPUT_FILE)) {
    const lines = readFileSync(INPUT_FILE, "utf8").split("\n").map(l => l.trim()).filter(Boolean);
    species = lines.map(l => ({ code: l.toLowerCase().replace(/\s+/g, "_"), displayName: l, scientificName: l }));
  }
  species = species.slice(0, LIMIT);

  console.log(`  Scraping ${species.length} species...\n`);
  console.log("  " + "─".repeat(64));

  const records   = [];
  const manifest  = [];

  for (let i = 0; i < species.length; i++) {
    const seed = species[i];
    const name = seed.scientificName ?? seed.displayName;
    const pad  = String(i + 1).padStart(2, " ");
    process.stdout.write(`  [${pad}/${species.length}] ${seed.displayName.padEnd(30)} `);

    // Fetch from each source with 600ms gaps to respect rate limits
    const perenual = await fetchPerenual(name);                          await sleep(400);
    const gbif     = await fetchGBIF(seed.scientificName ?? name);       await sleep(300);
    const wiki     = await fetchWikipedia(name);                         await sleep(200);

    // Wikimedia fallback image if Perenual unavailable
    let wikiMedia = null;
    if (!perenual?.image_url && !wiki?.wiki_image) {
      wikiMedia = await fetchWikimediaImage(seed.scientificName ?? name);
      await sleep(200);
    }
    const wikiEnriched = wiki ? {
      ...wiki,
      wiki_image: wiki.wiki_image ?? wikiMedia?.image_url ?? null,
    } : wikiMedia ? { wiki_image: wikiMedia.image_url, wiki_extract: "", wiki_description: "" } : null;

    const rec = buildRecord(seed, perenual, gbif, wikiEnriched);

    // Download image
    if (rec.image_url && !SKIP_IMAGES) {
      const ext      = rec.image_url.match(/\.(jpg|jpeg|png|webp)/i)?.[1] ?? "jpg";
      const filename = `${rec.code}.${ext}`;
      const destPath = join(IMG, filename);
      const ok = await downloadImage(rec.image_url, destPath);
      if (ok) rec.image_local_path = `species_images/${filename}`;
      await sleep(200);
    }

    const sources = [
      perenual  ? "perenual" : null,
      gbif      ? "gbif"     : null,
      wiki      ? "wiki"     : null,
      "seed",
    ].filter(Boolean).join("+");

    process.stdout.write(`[${sources}] conf=${rec.confidence} `);
    console.log(rec.image_local_path ? "📷" : "");

    records.push(rec);
    manifest.push({
      code:          rec.code,
      display_name:  rec.display_name,
      scientific_name: rec.scientific_name,
      sources,
      confidence:    rec.confidence,
      image_ok:      !!rec.image_local_path,
      warnings: [
        !perenual  ? "no_perenual"  : null,
        !gbif      ? "no_gbif"      : null,
        !wiki      ? "no_wikipedia" : null,
        !rec.image_url ? "no_image" : null,
      ].filter(Boolean),
    });
  }

  console.log("\n  " + "─".repeat(64));
  console.log("  Writing output files…\n");

  // ── species_dataset_full.csv ────────────────────────────────────────────────
  const fullCsvPath = join(OUT, "species_dataset_full.csv");
  const fullCsv = [
    FULL_COLUMNS.join(","),
    ...records.map(r => toCSVRow(r, FULL_COLUMNS)),
  ].join("\n");
  writeFileSync(fullCsvPath, fullCsv, "utf8");
  console.log(`  ✓ species_dataset_full.csv      (${records.length} rows, ${FULL_COLUMNS.length} columns)`);

  // ── species_dataset_ml.csv ──────────────────────────────────────────────────
  const mlCsvPath = join(OUT, "species_dataset_ml.csv");
  const mlRecords = records.map(r => ({
    species_key:          r.code,
    species_name:         r.display_name,
    climate_suitability:  r.climate_suitability,
    sunlight_preference:  r.sunlight_preference,
    water_demand:         r.water_demand,
    maintenance_need:     r.maintenance_need,
    root_aggressiveness:  r.root_aggressiveness,
    pollinator_value:     r.pollinator_value,
    edible:               r.edible ? 1 : 0,
    child_pet_safety:     r.child_pet_safety,
    native_support:       r.native_support,
    container_suitability: r.container_suitability,
    cooling_contribution: r.cooling_contribution,
    privacy_contribution: r.privacy_contribution,
    growth_habit:         r.growth_habit,
  }));
  const mlCsv = [
    ML_COLUMNS.join(","),
    ...mlRecords.map(r => toCSVRow(r, ML_COLUMNS)),
  ].join("\n");
  writeFileSync(mlCsvPath, mlCsv, "utf8");
  console.log(`  ✓ species_dataset_ml.csv        (${records.length} rows, ${ML_COLUMNS.length} columns)`);

  // ── species_dataset_seed.json ───────────────────────────────────────────────
  const seedJson = records.map(r => ({
    code:            r.code,
    displayName:     r.display_name,
    scientificName:  r.scientific_name || undefined,
    family:          r.family || undefined,
    category:        r.category,
    edible:          r.edible,
    flowering:       r.flowering,
    petSafe:         r.pet_safe,
    droughtTolerant: r.drought_tolerant,
    heatTolerant:    r.heat_tolerant,
    lowMaintenance:  r.low_maintenance,
    minSunHours:     r.min_sun_hours,
    maxSunHours:     r.max_sun_hours,
    droughtTolerance: r.drought_tolerance,
    growthHabit:     r.growth_habit,
    nativeRangeNotes: r.native_range_notes || undefined,
    invasiveRisk:    r.invasive_risk,
    mlWeight:        r.ml_weight,
    notes:           r.notes || undefined,
    tagsJson:        r.tags_json,
    active:          r.active,
  }));
  writeFileSync(join(OUT, "species_dataset_seed.json"), JSON.stringify(seedJson, null, 2), "utf8");
  console.log(`  ✓ species_dataset_seed.json     (${records.length} entries)`);

  // ── scrape_manifest.json ────────────────────────────────────────────────────
  const manifestOut = {
    generated_at: new Date().toISOString(),
    total_species: records.length,
    sources_used: ["perenual", "gbif", "wikipedia", "wikimedia", "seed"],
    api_keys_present: { perenual: !!PERENUAL_KEY, trefle: !!TREFLE_TOKEN },
    images_downloaded: records.filter(r => r.image_local_path).length,
    avg_confidence: (records.reduce((s, r) => s + r.confidence, 0) / records.length).toFixed(2),
    species: manifest,
  };
  writeFileSync(join(OUT, "scrape_manifest.json"), JSON.stringify(manifestOut, null, 2), "utf8");
  console.log(`  ✓ scrape_manifest.json          (avg confidence: ${manifestOut.avg_confidence})`);

  // ── DATASET_FIELDS.md ───────────────────────────────────────────────────────
  writeFileSync(join(OUT, "DATASET_FIELDS.md"), FIELD_DOCS, "utf8");
  console.log(`  ✓ DATASET_FIELDS.md             (field reference documentation)`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  const noImage  = records.filter(r => !r.image_url).length;
  const lowConf  = records.filter(r => r.confidence < 0.5).length;
  const hiConf   = records.filter(r => r.confidence >= 0.8).length;

  console.log("\n  ╔══════════════════════════════════╗");
  console.log("  ║         Scrape Summary           ║");
  console.log("  ╠══════════════════════════════════╣");
  console.log(`  ║  Species processed : ${String(records.length).padEnd(10)}    ║`);
  console.log(`  ║  Images available  : ${String(records.length - noImage).padEnd(10)}    ║`);
  console.log(`  ║  High confidence   : ${String(hiConf).padEnd(10)}    ║`);
  console.log(`  ║  Low confidence    : ${String(lowConf).padEnd(10)}    ║`);
  console.log(`  ║  Output dir        :                  ║`);
  console.log(`  ║  data/species/scraped/           ║`);
  console.log("  ╚══════════════════════════════════╝\n");

  if (noImage > 0) {
    console.log(`  ⚠  ${noImage} species have no image. Set PERENUAL_API_KEY to improve coverage.\n`);
  }
  if (lowConf > 0) {
    console.log(`  ⚠  ${lowConf} species have low confidence — manual review recommended.\n`);
    manifest.filter(m => m.confidence < 0.5).forEach(m => {
      console.log(`     · ${m.code} — ${m.warnings.join(", ")}`);
    });
    console.log();
  }

  console.log("  Done.\n");
}

main().catch(err => { console.error("\n  ✗ Fatal:", err.message); process.exit(1); });
