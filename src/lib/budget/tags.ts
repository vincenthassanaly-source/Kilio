// Tag de cache des lectures du Budget et des Comptes (voir cache.ts). Dans son
// propre fichier pour que les écritures qui l'expirent (actions/comptes.ts,
// transactions.ts, budgets.ts, categories-budget.ts, transactions-recurrentes.ts)
// ne forment pas d'import circulaire avec cache.ts, qui importe les lectures
// depuis ces mêmes actions.
export const BUDGET_TAG = "budget";
