/**
 * localStorage-backed store for margin manager positions.
 * Persists manager references so they survive page refreshes.
 */

const STORAGE_KEY = "oshio_positions";

export type StoredPosition = {
  managerAddress: string;
  poolKey: string; // e.g. "SUI_USDC"
  side: "long" | "short";
  collateralAsset: string;
  createdAt: number;
};

export function getStoredPositions(): StoredPosition[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addPosition(position: StoredPosition): void {
  const positions = getStoredPositions();
  positions.push(position);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
}

export function removePosition(managerAddress: string): void {
  const positions = getStoredPositions().filter(
    (p) => p.managerAddress !== managerAddress
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
}
