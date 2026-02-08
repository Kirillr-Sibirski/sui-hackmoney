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
 * Long:  maxLeverage = R / (R - 1)  (exposure = assets)
 * Short: maxLeverage = 1 / (R - 1)  (exposure = debt)
 */
export function getMaxLeverage(poolId: string, side: "long" | "short" = "long"): number {
  const params = riskParams[poolId];
  if (!params) return 5;
  const r = params.minBorrowRiskRatio;
  const raw = side === "long" ? r / (r - 1) : 1 / (r - 1);
  return Math.floor(raw * 10) / 10;
}

/** Get minBorrowRiskRatio for a pool */
export function getMinBorrowRiskRatio(poolId: string): number {
  return riskParams[poolId]?.minBorrowRiskRatio ?? 1.25;
}

/** Get liquidationRiskRatio for a pool */
export function getLiquidationRiskRatio(poolId: string): number {
  return riskParams[poolId]?.liquidationRiskRatio ?? 1.1;
}

/**
 * Minimum collateral required (in USD) for a given exposure.
 * C_min = T * (1 - 1/R_min)
 * where T = exposure in USD, R_min = minBorrowRiskRatio
 */
export function getMinCollateralUsd(exposureUsd: number, poolId: string): number {
  const rMin = getMinBorrowRiskRatio(poolId);
  return exposureUsd * (1 - 1 / rMin);
}

/** Get risk color class based on ratio */
export function getRiskColor(ratio: number): string {
  if (ratio >= 2.0) return "text-emerald-500";
  if (ratio >= 1.5) return "text-yellow-500";
  return "text-rose-500";
}

/** Get risk label — higher ratio = safer, lower ratio = more dangerous */
export function getRiskLabel(ratio: number): string {
  if (ratio >= 2.0) return "High";
  if (ratio >= 1.5) return "Moderate";
  return "Low";
}
