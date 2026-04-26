# Training report — {{experiment_name}}

## Run metadata

| Field | Value |
|-------|--------|
| Task | {{task}} |
| Experiment | {{experiment_name}} |
| Snapshot ID | {{training_snapshot_id}} |
| Model type | {{candidate_model_type}} |
| Code version | {{training_code_version}} |
| Notes | {{notes}} |

## Dataset

- **Path:** {{dataset_path}}
- **Row counts:** train={{n_train}} val={{n_val}} test={{n_test}}
- **Group column:** {{group_col}}
- **Source filter:** {{source_filter}}

### Source mix (train)

```json
{{source_mix_train_json}}
```

## Target & features

- **Target column:** {{target_column}}
- **Feature count:** {{n_features}}
- **Dropped (missing in data):** {{dropped_features}}

## Model

- **Estimator:** {{estimator_desc}}
- **Hyperparams:** `{{hyperparams_json}}`

## Metrics

### Validation

```json
{{metrics_val_json}}
```

### Test

```json
{{metrics_test_json}}
```

## Subgroup / extended metrics

```json
{{extended_metrics_json}}
```

## Artifacts

| Artifact | Path |
|----------|------|
| Model | `{{path_model}}` |
| Feature manifest | `{{path_manifest}}` |
| Metrics JSON | `{{path_metrics}}` |

## Error analysis / failure modes

{{error_analysis}}
