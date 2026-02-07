<p align="center">
  <img src="frontend/public/logo.svg" alt="Ōshio" width="80" />
</p>

<h1 align="center">Ōshio</h1>

<p align="center">
  Decentralized margin trading on Sui, powered by DeepBook V3.
</p>

<p align="center">
  Built during the <strong>ETHGlobal HackMoney 2026</strong> hackathon.
</p>

---

## What is Ōshio?

Ōshio is a non-custodial margin trading platform on the [Sui](https://sui.io) blockchain. It enables users to open leveraged long and short positions on token pairs using [DeepBook V3](https://deepbook.tech) margin pools, with real-time pricing from [Pyth Network](https://pyth.network) oracles.

### Key Features

- **Leveraged trading** — Up to 5x leverage on supported pairs (SUI/DBUSDC, DEEP/SUI, DEEP/DBUSDC)
- **Real-time oracle prices** — Live price feeds via Pyth Network Hermes SSE streaming
- **Risk management** — Real-time risk ratio, liquidation price, and exposure calculations
- **Collateral flexibility** — Use the pool's base asset, quote asset, or DEEP (with reduced fees)
- **Position management** — Modify collateral (add/withdraw) on open positions with projected risk ratio preview
- **Margin pool managers** — Automatic per-pool margin manager creation on first trade

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, React 19) |
| **Styling** | Tailwind CSS v4, shadcn/ui |
| **Blockchain** | Sui Network (`@mysten/sui` SDK) |
| **DEX** | DeepBook V3 (`@mysten/deepbook-v3`) |
| **Oracle** | Pyth Network (`@pythnetwork/hermes-client`) |
| **Wallet** | `@mysten/dapp-kit-react` |

## Getting Started

```bash
cd frontend
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Trade page (main)
│   └── dashboard/          # Position management dashboard
├── components/
│   ├── trading/            # TradeCard (core trading UI)
│   ├── layout/             # Header, navigation
│   ├── wallet/             # Wallet connection
│   └── ui/                 # shadcn/ui + custom components
├── config/                 # Pool configs, risk params, price feed IDs
├── hooks/                  # usePrices (Pyth oracle hook)
└── lib/
    ├── oracle.ts           # Pyth Hermes client, price fetching/streaming
    ├── risk.ts             # Risk ratio, max leverage, liquidation calculations
    └── deepbook/           # DeepBook SDK integration
```

## Configuration

All trading parameters are defined in JSON configs under `frontend/config/`:

- **`pools.json`** — Trading pairs and their properties
- **`pair_risk_params.json`** — Risk parameters per pair (minBorrowRiskRatio, liquidationRiskRatio)
- **`margin_pools.json`** — Margin pool on-chain IDs
- **`coins.json`** — Token metadata (addresses, decimals, icons)
- **`price_ids.json`** — Pyth price feed IDs for oracle integration

## License

MIT
