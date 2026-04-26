# Recommendation evaluation report

- Generated: **2026-03-31T07:11:25.513Z**
- Python stubbed (deterministic fallback): **yes**

| Scenario | gen.source | mode | layout | coverage | unresolved | HARD pass |
|----------|------------|------|--------|----------|------------|-----------|
| sunny_balcony_low_maintenance | catalog_hybrid_ts | partial_ml | attached | 100% | 0 | ok |
| hot_terrace_cooling | catalog_hybrid_ts | partial_ml | attached | 100% | 0 | ok |
| shaded_balcony_aesthetic | catalog_hybrid_ts | partial_ml | attached | 100% | 0 | ok |
| pet_safe_home_garden | catalog_hybrid_ts | partial_ml | attached | 100% | 0 | ok |
| edible_herb_setup | catalog_hybrid_ts | partial_ml | attached | 100% | 0 | ok |
| windy_highrise_balcony | catalog_hybrid_ts | partial_ml | attached | 100% | 0 | ok |
| water_scarce_terrace | catalog_hybrid_ts | partial_ml | attached | 100% | 0 | ok |

## Detail

### sunny_balcony_low_maintenance: Sunny balcony, low maintenance

- **Top open species:** Curry leaf screen [curry_leaf]; Vetiver grass [vetiver]; Lemongrass screen [lemongrass]; Sedum mix [sedum]; Frangipani (alt cultivar) [plumeria]; Holy basil (tulsi) [tulsi_holy]
- **Candidates:** total 6, open 6, blocked 0
- **Hard constraints:** open_with_hard=0, blocked_with_hard=0
- **mlErrors (preview):** python_runtime_unavailable_catalog_hybrid; catalog_fallback_reason:python_nonzero_exit; python_no_stdout_exit_1; python_exit_1

### hot_terrace_cooling: Hot terrace, cooling-first

- **Top open species:** Sedum mix [sedum]; Holy basil (tulsi) [tulsi_holy]; Curry leaf screen [curry_leaf]; Prickly pear [prickly_pear]; Money plant (dense) [pothos]; Lemongrass screen [lemongrass]; Frangipani (alt cultivar) [plumeria]; Bougainvillea [bougainvillea]
- **Candidates:** total 8, open 8, blocked 0
- **Hard constraints:** open_with_hard=0, blocked_with_hard=0
- **mlErrors (preview):** python_runtime_unavailable_catalog_hybrid; catalog_fallback_reason:python_nonzero_exit; python_no_stdout_exit_1; python_exit_1

### shaded_balcony_aesthetic: Shaded balcony, aesthetic goal

- **Top open species:** Money plant (dense) [pothos]; Dracaena marginata [dracaena_marginata]; Creeping fig [ficus_pumila]; Snake plant [snake_plant]; Coleus [coleus]; Spider plant [spider_plant]
- **Candidates:** total 6, open 6, blocked 0
- **Hard constraints:** open_with_hard=0, blocked_with_hard=0
- **mlErrors (preview):** python_runtime_unavailable_catalog_hybrid; catalog_fallback_reason:python_nonzero_exit; python_no_stdout_exit_1; python_exit_1

### pet_safe_home_garden: Pet-safe home garden

- **Top open species:** Holy basil (tulsi) [tulsi_holy]; Vetiver grass [vetiver]; Lemongrass screen [lemongrass]; Malabar spinach [malabar_spinach]; Sedum mix [sedum]; Sweet potato vine [sweet_potato_vine]; Mint [mint]; Marigold [marigold]
- **Candidates:** total 8, open 8, blocked 0
- **Hard constraints:** open_with_hard=0, blocked_with_hard=0
- **mlErrors (preview):** python_runtime_unavailable_catalog_hybrid; catalog_fallback_reason:python_nonzero_exit; python_no_stdout_exit_1; python_exit_1

### edible_herb_setup: Edible / herb-focused

- **Top open species:** Lemongrass screen [lemongrass]; Curry leaf screen [curry_leaf]; Cherry tomato [cherry_tomato]; Holy basil (tulsi) [tulsi_holy]; Ridge gourd [luffa]; Malabar spinach [malabar_spinach]; Okra [okra]; Prickly pear [prickly_pear]
- **Candidates:** total 8, open 8, blocked 0
- **Hard constraints:** open_with_hard=0, blocked_with_hard=0
- **mlErrors (preview):** python_runtime_unavailable_catalog_hybrid; catalog_fallback_reason:python_nonzero_exit; python_no_stdout_exit_1; python_exit_1

### windy_highrise_balcony: Windy high-rise balcony

- **Top open species:** Holy basil (tulsi) [tulsi_holy]; Vetiver grass [vetiver]; Curry leaf screen [curry_leaf]; Malabar spinach [malabar_spinach]
- **Candidates:** total 6, open 4, blocked 2
- **Hard constraints:** open_with_hard=0, blocked_with_hard=2
- **mlErrors (preview):** python_runtime_unavailable_catalog_hybrid; catalog_fallback_reason:python_nonzero_exit; python_no_stdout_exit_1; python_exit_1

### water_scarce_terrace: Scarce water — open candidates must not pair sprinkler/mist with scarce water

- **Top open species:** Holy basil (tulsi) [tulsi_holy]; Sedum mix [sedum]; Prickly pear [prickly_pear]; Money plant (dense) [pothos]; Portulaca [portulaca]; Snake plant [snake_plant]
- **Candidates:** total 6, open 6, blocked 0
- **Hard constraints:** open_with_hard=0, blocked_with_hard=0
- **mlErrors (preview):** python_runtime_unavailable_catalog_hybrid; catalog_fallback_reason:python_nonzero_exit; python_no_stdout_exit_1; python_exit_1
