# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ōshio is a margin trading platform on Sui blockchain, built with Next.js and DeepBook V3. This is a frontend-only application that connects to the Sui blockchain via SDK.
The DeekBook margin documentation can be found here https://docs.sui.io/standards/deepbook-margin-sdk. The TypeScript SDK can be found here https://www.npmjs.com/package/@mysten/deepbook-v3.
All the information regarding the testnet is in this document https://docs.google.com/document/d/1UQw2JZ3X3UN4641_WkvqdCehP7jDPgFmgt2KFti6bjs/edit?tab=t.0.


## Commands

All commands run from the `frontend/` directory:

```bash
pnpm dev      # Start development server (localhost:3000)
pnpm build    # Build for production
pnpm start    # Run production build
pnpm lint     # Run ESLint
```

## Architecture

- **Framework:** Next.js 16 with App Router and React 19
- **Styling:** Tailwind CSS v4 + shadcn/ui (New York style)
- **Blockchain:** @mysten/sui SDK + @mysten/deepbook-v3 for margin trading
- **Package Manager:** pnpm (bun also supported)

### Key Directories

```
frontend/
├── app/           # Next.js App Router (pages, layouts)
├── lib/utils.ts   # Utility functions (cn() for class merging)
├── components/    # React components (add via shadcn/ui CLI)
└── hooks/         # Custom React hooks
```

### Path Aliases

- `@/*` maps to the frontend root
- `@/components/ui` for shadcn/ui components
- `@/lib/utils` for the `cn()` utility

## Styling

Uses Tailwind CSS with CSS variables defined in `app/globals.css`. Dark mode is supported via `.dark` class. Use the `cn()` helper from `lib/utils.ts` for conditional class merging.

## Adding shadcn/ui Components

```bash
npx shadcn@latest add <component-name>
```

Components will be added to `components/ui/` with RSC support enabled.

<!-- ## Prompt Sequence
1/ Rediect the user to the dashboard page once the position was opened successfully.


2/ The **interest** rate is displayed as 0% APR for some reason for all the pools, look into that and fix the problem pls. Double check how you fetch the APRs. You can get the current borrow interest rate from the Margin Pool via the DeepBook Margin SDK’s read‑only functions.

Using the Margin Pool SDK (TypeScript)
The SDK exposes an interestRate read function keyed by the asset/pool:

// Assume you have a configured DeepBookClient with marginPoolContract
const coinKey = 'USDC'; // or 'SUI', 'DEEP', etc.

const tx = new Transaction();
const interestRate = tx.add(
  client.marginPoolContract.interestRate(coinKey),
);

// Then dry-run or execute the PTB to read the value
This interestRate(coinKey) call returns the current borrow APR for that margin pool, computed from utilization and the pool’s InterestConfig (base rate, slopes, optimal utilization, etc.).[Margin Pool SDK read-only; Interest rates]


 -->