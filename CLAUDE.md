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
1/
Now we need to display all the open positions in the dashboard. Here is how we do it: 
 @description Get comprehensive state information for a margin manager
	 * @param {string} poolKey The key to identify the pool
	 * @param {string} marginManagerId The ID of the margin manager
	 * @returns A function that takes a Transaction object
	 * @returns Returns (manager_id, deepbook_pool_id, risk_ratio, base_asset, quote_asset,
	 *                   base_debt, quote_debt, base_pyth_price, base_pyth_decimals,
	 *                   quote_pyth_price, quote_pyth_decimals)
	 */
	managerState = (poolKey: string, marginManagerId: string) => (tx: Transaction) => {
		const pool = this.#config.getPool(poolKey);
		const baseCoin = this.#config.getCoin(pool.baseCoin);
		const quoteCoin = this.#config.getCoin(pool.quoteCoin);
		const baseMarginPool = this.#config.getMarginPool(pool.baseCoin);
		const quoteMarginPool = this.#config.getMarginPool(pool.quoteCoin);
		return tx.moveCall({
			target: `${this.#config.MARGIN_PACKAGE_ID}::margin_manager::manager_state`,
			arguments: [
				tx.object(marginManagerId),
				tx.object(this.#config.MARGIN_REGISTRY_ID),
				tx.object(baseCoin.priceInfoObjectId!),
				tx.object(quoteCoin.priceInfoObjectId!),
				tx.object(pool.address),
				tx.object(baseMarginPool.address),
				tx.object(quoteMarginPool.address),
				tx.object.clock(),
			],
			typeArguments: [baseCoin.type, quoteCoin.type],
		});
	};

2/ And then to get the current interest rate:
	/**
	 * @description Get the current interest rate
	 * @param {string} coinKey The key to identify the pool
	 * @returns A function that takes a Transaction object
	 */
	interestRate = (coinKey: string) => (tx: Transaction) => {
		const marginPool = this.#config.getMarginPool(coinKey);
		return tx.moveCall({
			target: `${this.#config.MARGIN_PACKAGE_ID}::margin_pool::interest_rate`,
			arguments: [tx.object(marginPool.address)],
			typeArguments: [marginPool.type],
		});
	};
By calling the marginPool.ts in the SDK
3/ Better show when the user doesn't have enough funds in their wallet
 -->