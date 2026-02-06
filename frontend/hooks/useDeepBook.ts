"use client";

import { useState, useEffect } from "react";
import {
  calculateLiquidationPrice,
  calculatePositionSize,
  calculateRiskScore,
} from "@/lib/deepbook";
import type { OpenPositionParams, DepositParams, WithdrawParams } from "@/lib/deepbook";

export function useDeepBook() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Return early state for SSR and initial render
  // The actual wallet integration happens through the ConnectWalletButton
  // and dAppKit hooks used directly in components
  return {
    // State - these would be populated from dAppKit hooks in actual usage
    isConnected: false,
    address: undefined as string | undefined,
    isPending: false,

    // Actions - placeholder implementations
    // In actual usage, these would use dAppKit.signAndExecuteTransaction
    openPosition: async (params: OpenPositionParams) => {
      console.log("Open position:", params);
      throw new Error("Use dAppKit hooks directly in your component");
    },
    closePosition: async (poolId: string, positionId: string) => {
      console.log("Close position:", poolId, positionId);
      throw new Error("Use dAppKit hooks directly in your component");
    },
    deposit: async (params: DepositParams) => {
      console.log("Deposit:", params);
      throw new Error("Use dAppKit hooks directly in your component");
    },
    withdraw: async (params: WithdrawParams) => {
      console.log("Withdraw:", params);
      throw new Error("Use dAppKit hooks directly in your component");
    },

    // Utilities - these work everywhere
    calculateLiquidationPrice,
    calculatePositionSize,
    calculateRiskScore,
  };
}
