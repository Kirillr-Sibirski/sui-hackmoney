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
3/ 
ok i cna see that you're not passing the managerKey properrly to the 
   depsoit fucntions etc. Call newMarginManager(poolKey) in a          
  transaction:                                                         
  let tx = new Transaction();                                          
  const poolKey = 'SUI_DBUSDC';                                        
  tx.add(this.client.deepbook.marginManager.newMarginManager(poolKey)) 
  ;                                                                    
  Sign & execute, then read the created MarginManager object ID:       
  const result = await this.client.core.signAndExecuteTransaction({    
      transaction: tx,                                                 
      signer: this.keypair,                                            
      include: { effects: true, objectTypes: true },                   
  });                                                                  
                                                                       
  if (result.$kind === 'FailedTransaction') {                          
      throw new Error('Transaction failed');                           
  }                                                                    
                                                                       
  const objectTypes = result.Transaction?.objectTypes ?? {};           
  const marginManagerAddress =                                         
  result.Transaction?.effects?.changedObjects?.find(                   
      (obj) =>                                                         
          obj.idOperation === 'Created' &&                             
          objectTypes[obj.objectId]?.includes('MarginManager'),        
  )?.objectId;                                                         
                                                                       
  if (!marginManagerAddress) {                                         
      throw new Error('Failed to create margin manager');              
  }                                                                    
  [Margin manager keys]                                                
                                                                       
  Create a MarginManager entry in the SDK config and pick a managerKey 
   string:                                                             
  const MARGIN_MANAGER_KEY = 'MARGIN_MANAGER_1';                       
                                                                       
  const marginManagers: { [key: string]: MarginManager } = {           
      [MARGIN_MANAGER_KEY]: {                                          
          address: marginManagerAddress,                               
          poolKey: poolKey,                                            
      },                                                               
  };                                                                   
  Recreate the client with this map so you can later use managerKey:   
  this.client = this.#createClient(this.env, marginManagers);          
  [Margin manager keys]                                                
                                                                       
  After this, you can call functions like:                             
                                                                       
  traderClient.client.deepbook.marginManager.depositBase('MARGIN_MANAG 
  ER_1', 100)(tx); here how to get the managerKey. you're curretnnly   
  just passing the margin pool name    

4/ 
Lets implement a close position functionality. The user will have to reapy all debts. Here is how it will work (with an example amount).
Place a closing (reduce) order
To close a long SUI position, you sell SUI back into USDC via the margin manager. You can:

Use a normal order (limit/market), or
Use a reduce-only order so it only decreases your debt position. [Orders contract info]
Example: close (reduce) 10 SUI with a reduce-only limit order:

// Close 10 SUI of your margined long using a reduce-only limit order
placeReduceOnly = (tx: Transaction) => {
  const poolKey = 'SUI_DBUSDC';
  const managerKey = 'MARGIN_MANAGER_1';
  tx.add(
    this.poolProxyContract.placeReduceOnlyLimitOrder({
      poolKey,
      marginManagerKey: managerKey,
      clientOrderId: 'close-10-sui',
      price: 2.6,        // your chosen exit price
      quantity: 10,      // amount of SUI to close
      isBid: false,      // selling SUI (long -> close by selling)
      payWithDeep: true,
    }),
  );
};
[Orders SDK examples]

If you want immediate execution, use placeReduceOnlyMarketOrder instead (same params but without price/expiration). [Orders SDK functions]

Withdraw settled amounts to the MarginManager
After trades fill, proceeds sit as “settled amounts” and must be pulled into the manager’s balance:

withdrawSettled = (tx: Transaction) => {
  const managerKey = 'MARGIN_MANAGER_1';
  tx.add(this.poolProxyContract.withdrawSettledAmounts(managerKey));
};
[Orders SDK functions]

Repay the borrowed side
Once you’ve sold SUI and have USDC back in the manager, repay the loan (for a 5x long SUI/USDC, you borrowed quote/USDC):

// Repay all borrowed quote (USDC)
repayLoan = (tx: Transaction) => {
  const managerKey = 'MARGIN_MANAGER_1';
  // No amount specified = repay all
  tx.add(this.marginContract.repayQuote(managerKey));
};
[Margin Manager examples]

If your original position borrowed base instead, you’d use the corresponding repay function (not explicitly shown in the sources; only repayQuote is documented, so I can’t quote the exact name for base repayment).

Withdraw remaining collateral / profit
Once debt is repaid and your risk ratio is high (no or low debt), you can withdraw remaining collateral from the manager. The docs only show depositBase/borrowQuote/repayQuote; they don’t show the exact withdraw function signature, so I can’t provide the precise call, but conceptually:

Call the appropriate withdraw... function from the Margin Manager contract to move remaining assets back to your wallet, respecting the minimum withdraw risk ratio. [Risk ratio example]
So for “10 SUI at 5x margin”, the high‑level sequence is:

Place a reduce-only sell order (limit or market) for 10 SUI via your MarginManager.
After it fills, call withdrawSettledAmounts so proceeds are in the manager.
Call repayQuote (for a SUI/USDC long) to clear the borrowed USDC.
Withdraw remaining collateral/profit from the manager.
If you tell me whether your 5x position is long or short and which asset you borrowed (base vs quote), I can adapt the exact order direction (isBid true/false) and which repay function you’ll need.

5/ 
User rejected transactions must be better handles pls, not jsut through a random error. 
 -->