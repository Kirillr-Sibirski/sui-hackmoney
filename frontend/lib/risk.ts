import pairRiskParams from "@/config/pair_risk_params.json";

const riskParams = pairRiskParams.riskParameters as Record<
  string,
  { minBorrowRiskRatio: number; liquidationRiskRatio: number }
>;

/**
 * Calculate risk ratio = total_assets / total_debts
 */
export function calculateRiskRatio(
  totalAssetsUsd: number,
  totalDebtsUsd: number
): number {
  if (totalDebtsUsd <= 0) return Infinity;
  return totalAssetsUsd / totalDebtsUsd;
}

/**
 * Calculate new risk ratio after modifying collateral on an existing position.
 */
export function calculateModifiedRiskRatio(
  currentCollateral: number,
  deltaCollateral: number,
  collateralPrice: number,
  currentRiskRatio: number
): number {
  const deltaUsd = deltaCollateral * collateralPrice;
  const currentCollateralUsd = currentCollateral * collateralPrice;

  if (currentRiskRatio <= 1) return currentRiskRatio;

  const currentDebtsUsd = currentCollateralUsd / (currentRiskRatio - 1);
  const currentAssetsUsd = currentDebtsUsd * currentRiskRatio;
  const newAssetsUsd = currentAssetsUsd + deltaUsd;

  return calculateRiskRatio(newAssetsUsd, currentDebtsUsd);
}

/**
 * Max leverage from minBorrowRiskRatio.
 * Formula: maxLeverage = 1 / (1 - 1/minBorrowRiskRatio)
 */
export function getMaxLeverage(poolId: string): number {
  const params = riskParams[poolId];
  if (!params) return 5;
  const r = params.minBorrowRiskRatio;
  return Math.floor((1 / (1 - 1 / r)) * 10) / 10;
}

/** Get risk color class based on ratio */
export function getRiskColor(ratio: number): string {
  if (ratio >= 2.0) return "text-emerald-500";
  if (ratio >= 1.5) return "text-yellow-500";
  return "text-rose-500";
}

/** Get risk label */
export function getRiskLabel(ratio: number): string {
  if (ratio >= 2.0) return "Safe";
  if (ratio >= 1.5) return "Moderate";
  return "High";
}
