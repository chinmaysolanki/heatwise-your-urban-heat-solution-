/**
 * Maps recommendation-engine `Plant.id` → `SpeciesCatalog.code` when a single catalog row is the intended link.
 * `null` means no safe catalog row—do not invent codes (resolution stays `unresolved` downstream).
 */
export const ENGINE_PLANT_ID_TO_CATALOG_CODE: Record<string, string | null> = {
  sedum_acre: "sedum",
  sedum_reflexum: "sedum",
  sempervivum: null,
  festuca_glauca: null,
  stipa_tenuissima: null,
  pennisetum_alopecuroides: null,
  lavandula: null,
  armeria_maritima: null,
  echinacea_purpurea: null,
  salvia_nemorosa: null,
  agapanthus: null,
  pittosporum_tobira: null,
  rosmarinus_officinalis: null,
  buxus_sempervirens: null,
  hedera_helix: null,
  parthenocissus_quinquefolia: null,
  lonicera_japonica: null,
  wisteria_sinensis: null,
  solanum_lycopersicum: "cherry_tomato",
  cucurbita_pepo: null,
  phaseolus_coccineus: null,
  polystichum_setiferum: null,
  dryopteris_filix_mas: null,
  mentha_spicata: "mint",
  thymus_serpyllum: null,
  ocimum_basilicum: "basil_sweet",
  allium_schoenoprasum: null,
};
