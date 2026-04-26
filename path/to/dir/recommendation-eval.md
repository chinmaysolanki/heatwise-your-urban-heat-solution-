# Recommendation evaluation report

- Generated: **2026-03-31T04:40:36.913Z**
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

- **Top open species:** Lemongrass screen [lemongrass_dense]; Curry leaf screen [curry_screen]; Vetiver grass [vetiver]; Sedum mix [sedum]; Holy basil (tulsi) [tulsi_holy]; Curry leaf [curry_leaf]
- **Candidates:** total 6, open 6, blocked 0
- **Hard constraints:** open_with_hard=0, blocked_with_hard=0
- **mlErrors (preview):** python_runtime_unavailable_catalog_hybrid; catalog_fallback_reason:python_nonzero_exit; python_no_stdout_exit_1; python_exit_1

### hot_terrace_cooling: Hot terrace, cooling-first

- **Top open species:** Lemongrass screen [lemongrass_dense]; Curry leaf screen [curry_screen]; Vetiver grass [vetiver]; Sedum mix [sedum]; Holy basil (tulsi) [tulsi_holy]; Curry leaf [curry_leaf]; Lemongrass [lemongrass]; Prickly pear [prickly_pear]
- **Candidates:** total 8, open 8, blocked 0
- **Hard constraints:** open_with_hard=0, blocked_with_hard=0
- **mlErrors (preview):** python_runtime_unavailable_catalog_hybrid; catalog_fallback_reason:python_nonzero_exit; python_no_stdout_exit_1; python_exit_1

### shaded_balcony_aesthetic: Shaded balcony, aesthetic goal

- **Top open species:** Bougainvillea [bougainvillea]; Holy basil (tulsi) [tulsi_holy]; Hibiscus [hibiscus]; Dwarf areca palm [areca_palm_dwarf]; Plumeria [plumeria]; Dwarf bamboo [bamboo_dwarf]
- **Candidates:** total 6, open 6, blocked 0
- **Hard constraints:** open_with_hard=0, blocked_with_hard=0
- **mlErrors (preview):** python_runtime_unavailable_catalog_hybrid; catalog_fallback_reason:python_nonzero_exit; python_no_stdout_exit_1; python_exit_1

### pet_safe_home_garden: Pet-safe home garden

- **Top open species:** Vetiver grass [vetiver]; Holy basil (tulsi) [tulsi_holy]; Lemongrass screen [lemongrass_dense]; Sedum mix [sedum]; Curry leaf screen [curry_screen]; Malabar spinach [malabar_spinach]; Curry leaf [curry_leaf]; Lemongrass [lemongrass]
- **Candidates:** total 8, open 8, blocked 0
- **Hard constraints:** open_with_hard=0, blocked_with_hard=0
- **mlErrors (preview):** python_runtime_unavailable_catalog_hybrid; catalog_fallback_reason:python_nonzero_exit; python_no_stdout_exit_1; python_exit_1

### edible_herb_setup: Edible / herb-focused

- **Top open species:** Holy basil (tulsi) [tulsi_holy]; Bougainvillea [bougainvillea]; Cherry tomato [cherry_tomato]; Lemongrass screen [lemongrass_dense]; Curry leaf screen [curry_screen]; Okra [okra]; Ridge gourd [luffa]; Malabar spinach [malabar_spinach]
- **Candidates:** total 8, open 8, blocked 0
- **Hard constraints:** open_with_hard=0, blocked_with_hard=0
- **mlErrors (preview):** python_runtime_unavailable_catalog_hybrid; catalog_fallback_reason:python_nonzero_exit; python_no_stdout_exit_1; python_exit_1

### windy_highrise_balcony: Windy high-rise balcony

- **Top open species:** Holy basil (tulsi) [tulsi_holy]; Lemongrass screen [lemongrass_dense]; Curry leaf screen [curry_screen]; Malabar spinach [malabar_spinach]
- **Candidates:** total 6, open 4, blocked 2
- **Hard constraints:** open_with_hard=0, blocked_with_hard=2
- **mlErrors (preview):** python_runtime_unavailable_catalog_hybrid; catalog_fallback_reason:python_nonzero_exit; python_no_stdout_exit_1; python_exit_1

### water_scarce_terrace: Scarce water — open candidates must not pair sprinkler/mist with scarce water

- **Top open species:** Bougainvillea [bougainvillea]; Holy basil (tulsi) [tulsi_holy]; Dwarf areca palm [areca_palm_dwarf]; Hibiscus [hibiscus]; Plumeria [plumeria]; Dwarf bamboo [bamboo_dwarf]
- **Candidates:** total 6, open 6, blocked 0
- **Hard constraints:** open_with_hard=0, blocked_with_hard=0
- **mlErrors (preview):** python_runtime_unavailable_catalog_hybrid; catalog_fallback_reason:python_nonzero_exit; python_no_stdout_exit_1; python_exit_1
