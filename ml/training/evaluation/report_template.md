# HeatWise training run — evaluation report

**Run ID:** {{ run_id }}  
**Task:** {{ task }}  
**Data:** {{ data_provenance }}  
**Timestamp:** {{ timestamp }}

## Summary

| Metric | Train | Val | Test |
|--------|-------|-----|------|
| {{ primary_metric_name }} | {{ train_primary }} | {{ val_primary }} | {{ test_primary }} |

## Regression tasks (feasibility, heat mitigation)

| Split | MAE | RMSE | R² |
|-------|-----|------|-----|
| Train | {{ train_mae }} | {{ train_rmse }} | {{ train_r2 }} |
| Val | {{ val_mae }} | {{ val_rmse }} | {{ val_r2 }} |
| Test | {{ test_mae }} | {{ test_rmse }} | {{ test_r2 }} |

## Ranking / selection

| Split | Pairwise AUC | Top-1 acc (per project) | nDCG@K (mean) |
|-------|----------------|-------------------------|---------------|
| Train | {{ train_pair_auc }} | {{ train_top1 }} | {{ train_ndcg }} |
| Val | {{ val_pair_auc }} | {{ val_top1 }} | {{ val_ndcg }} |
| Test | {{ test_pair_auc }} | {{ test_top1 }} | {{ test_ndcg }} |

## Data & leakage checks

- [ ] Splits are by `project_id` only  
- [ ] No label columns in feature matrix for deployment-bound models  
- [ ] Encoder/scaler fit **train** only  
- [ ] Row counts: train {{ n_train }} / val {{ n_val }} / test {{ n_test }}  

## Notes

{{ notes }}
