<p align="center">
  <img src="frontend/public/logo.svg" alt="Ōshio" width="80" />
</p>

<h1 align="center">Ōshio</h1>

<p align="center">
  Built during the <strong>ETHGlobal HackMoney 2026</strong> hackathon.
</p>

---

## Short Description

Margin trading on Sui that anyone can use — open leveraged positions in a few clicks.

## Description

Ōshio is a non-custodial margin trading platform on Sui, designed to make leveraged trading as simple as a swap. Existing margin platforms overwhelm users with order books, funding rates, and dozens of parameters. Ōshio strips all of that away: pick a pair, choose your collateral, set your leverage with a slider, and trade. One screen to open a position, one dashboard to manage everything.

Under the hood, Ōshio connects directly to DeepBook V3 margin pools on Sui mainnet. Users can go long or short with up to 5x leverage on pairs like SUI/USDC, DEEP/USDC, and WAL/USDC. Live oracle prices stream in real-time from Pyth Network, and the UI shows projected risk ratios, liquidation prices, and borrowing rates before you confirm, so you always know your exposure without digging through advanced panels. Collateral can be added or withdrawn from open positions at any time, with an instant preview of how it changes your risk.

## How It's Made

Ōshio is a frontend-only application built with Next.js 16 and styled with Tailwind CSS v4 and shadcn/ui.

The core trading engine uses the `@mysten/deepbook-v3` TypeScript SDK to construct Programmable Transaction Blocks (PTBs) for margin operations: creating margin managers, depositing collateral, borrowing, placing market orders, repaying debt, and withdrawing funds. A key architectural constraint is that creating a new margin manager and then using it (borrow + order) requires two separate transactions, the manager must become a shared on-chain object before it can be referenced, so the app shows multi-step transaction sequences transparently for the user.

Price feeds come from Pyth Network's Hermes service via Server-Sent Events (SSE), giving the UI real-time streaming prices without polling. Risk calculations (risk ratio, liquidation price, max leverage) are computed locally using on-chain margin parameters queried through `simulateTransaction` calls, this lets us read contract state (pool liquidity, manager balances, interest rates) without submitting actual transactions. Wallet connection is handled by `@mysten/dapp-kit-react`.

## Getting Started

```bash
cd frontend
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## License

MIT
