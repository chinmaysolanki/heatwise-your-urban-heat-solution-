# Deprecated path (space in folder name)

This directory previously held a **stale copy** of layout/recommendation TypeScript modules. It was **excluded from `tsconfig.json`** and not imported anywhere.

**Canonical implementation:** [`../recommendation-engine/`](../recommendation-engine/) (hyphenated, imported as `@/recommendation-engine`).

See [`docs/ARCHITECTURE_RECOMMENDATION_ENGINES.md`](../docs/ARCHITECTURE_RECOMMENDATION_ENGINES.md).

`tsconfig.json` excludes this directory so it is never type-checked or imported as code.
