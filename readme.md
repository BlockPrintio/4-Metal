# 4-Metal

**Trade the world's major metal assets — on-chain, open, and non-custodial.**

4-Metal Trader is a decentralised synthetic asset protocol built on Cardano that brings real-world precious metal markets to the blockchain. Users can take exposure to gold, silver, platinum, and palladium prices by minting synthetic tokens backed by ADA collateral — no broker, no KYC, no custody risk.

---

## The Problem

Precious metals are a $10 trillion market. Yet accessing them on-chain today means either:

- Trusting a centralised custodian to actually hold the physical asset
- Paying high fees and settlement delays through traditional commodity brokers
- Using synthetic protocols on EVM chains where gas costs make small positions uneconomical

There is no permissionless, low-fee, non-custodial way to trade gold and silver as a Cardano user today.

---

## What 4-Metal Trader Does

4-Metal Trader issues synthetic metal tokens — **aXAU** (gold) and **aXAG** (silver) to start — that track real-world spot prices sourced from Charli3, Cardano's native decentralised oracle network.

Each token is:

- **Overcollateralised** — backed by at least 150% ADA collateral locked in a vault
- **Price-accurate** — pegged to live Forex spot prices updated on-chain every 10 minutes
- **Non-custodial** — no company holds your collateral; the smart contract does
- **Composable** — standard Cardano native tokens, tradeable on any DEX
- **Liquidity** —  The platform will provide massive liquidity for the synthetic assets on DEXs
---

## Starting Assets

| Token | Tracks | Underlying Market |
|---|---|---|
| aXAU | Gold spot price (XAU/USD) | Forex / COMEX |
| aXAG | Silver spot price (XAG/USD) | Forex / COMEX |

Platinum (XPT) and palladium (XPD) are next in the roadmap once the core protocol is audited and live.

---

## How It Works

### Minting (going long)

1. A user opens a **vault** by locking ADA as collateral
2. They mint aXAU or aXAG up to the maximum allowed by the 150% collateral ratio
3. The minted tokens are standard Cardano native assets — hold them, trade them, or provide liquidity on a DEX
4. The oracle price feed updates every 10 minutes; the vault's health is checked at every interaction

### Burning (closing the position)

1. The user returns their aXAU or aXAG to the protocol
2. Their ADA collateral is unlocked and returned to their wallet
3. Profit or loss is realised through the difference between the ADA value at mint time and the ADA value at burn time

### Example

> ADA is $0.26. XAU is $3,285. One aXAU costs ~12,730 ADA.
>
> Alice locks 20,000 ADA (~$5,200) and mints 1 aXAU (requires 19,095 ADA minimum at 150% ratio).
>
> Gold rises 10%. One aXAU now costs ~14,000 ADA.
>
> Alice burns her aXAU, receives her collateral back, and the position has effectively gained ~1,270 ADA in value through the price appreciation — all on-chain, in her own wallet the entire time.

---

## The Vault System

Every position in 4-Metal is a **vault** — a UTxO on Cardano holding:

- ADA collateral
- A unique **Vault NFT** that identifies this specific position
- A datum recording the owner, collateral amount, synths minted, and asset type

The vault owner also receives a **Receipt Token** to their wallet — an off-chain proof of ownership that wallets and indexers can display without querying the script address.

### Collateral Ratio
Collateral Ratio = (ADA Collateral) / (Synths Minted × Current Price) × 100


| Ratio | Status |
|---|---|
| ≥ 200% | Healthy — well overcollateralised |
| 150–200% | Safe — within protocol bounds |
| < 150% | At risk — eligible for liquidation |

---

## Liquidation

When ADA price drops sharply, some vaults fall below the 150% minimum. 4-Metal uses a market-driven liquidation mechanism to clear these positions before they become bad debt.

Any wallet holder That holds 4-Metal Trader Token or some large amount of assets either gold or silver or ADA can act as a **liquidator**:

1. They burn the vault's outstanding synth tokens (which they must hold)
2. They receive the vault's ADA collateral plus a **10% liquidation bonus** as reward

This creates a competitive incentive: when a vault goes underwater, liquidators race to close it and pocket the bonus. The protocol stays solvent because bad debt is cleared immediately by market participants rather than relying on a centralised backstop.

The vault owner is not robbed — they received and kept the aXAU/aXAG when they minted it. The liquidation clears their outstanding liability. The 10% penalty is the cost of failing to manage their position, written into the contract they agreed to when opening the vault.

---

## Oracle Infrastructure

4-Metal relies on **Charli3** — Cardano's native decentralised oracle network — for all price data.

- Prices update on-chain every 10 minutes
- Each oracle UTxO is authenticated by a unique NFT, preventing spoofed feeds
- Smart contracts verify price freshness at every transaction using the validity range
- An oracle pause mechanism protects users during extreme market events or feed failures

No price, no transaction. The protocol cannot process mints or withdrawals with stale data.

---

## How to run and test

**Oracle Feed Note**  
We made custom changes to the oracle node for **1-of-1 signature** support. The gold and silver feeds share the **same address** but are identified by their own distinct policy IDs:  

- **Gold (aXAU)**: `63fb25158563dd7e45300fe997604f00579f14dacc3edc414e8d8755`  
- **Silver (aXAG)**: `598c7c94f56a456b01d31139d33fa3392266dd1eec7fc2e115283fc8`

### Step 1: Run the Oracle Nodes (Gold + Silver)

1. Clone our forked oracle node repo (Blockfrost dependency fix):  
   ```bash
   git clone https://github.com/Temasar1/charli3-pull-oracle-node/tree/fix/blockfrost-depedency
   cd charli3-pull-oracle-node

   Install Dependencies:

```
   poetry install
```

Add your Blockfrost Key:
Open ./configs/config-gold.yml and ./configs/config-silver.yml.
Paste your Blockfrost Preprod Project ID here:

```
ChainQuery:
  blockfrost:
    project_id: "your_preprod_project_id_here"
```
Start the Nodes (open two separate terminals):

```
poetry run python node/main.py run -c configs/config-gold.yml --port 8000
```

```
poetry run python node/main.py run -c configs/config-silver.yml --port 8001
```

Step 2: Pull Oracle Data & Go Live (SDK)

    ```
    git clone https://github.com/Temasar1/charli3-pull-oracle-sdk
    cd charli3-pull-oracle-sdk
    ```
    Run the automated pull script (handles both gold and silver):

    ```
    bash scripts/auto_pull.sh

    ```
    Done!
The oracle feeds will go live in less than 10 minutes.
You can now start testing and trading at:

https://4-metal.vercel.app/

(Preprod network only — contracts are unaudited, use test ADA only.)

for the sake of this hackathon we have brought of flexibility to our contract 

## Roadmap
### Phase 1 — Gold & Silver (current)

aXAU and aXAG vaults live on preprod
Core protocol: mint, burn, liquidation
Off-chain SDK (Mesh) for wallet integration

### Phase 2 — DEX Integration

aXAU/ADA and aXAG/ADA liquidity pools on Minswap and SundaeSwap
Price tracking dashboard
Liquidation bot for keeper network

### Phase 3 — Platinum & Palladium

aXPT (platinum) and aXPD (palladium) vaults
Multi-asset vault: one collateral position backing multiple synthetics

### Phase 4 — Full Metal Exchange

Trading interface — long/short positions with leverage
Cross-collateral vaults
Protocol governance token for parameter control (collateral ratio, bonus rate, new assets)


## Token Summary

TokenTypeDescriptionaXAUSyntheticTracks XAU/USD gold spot priceaXAGSyntheticTracks XAG/USD silver spot priceVault NFTIdentityUnique per vault, locked in scriptReceipt TokenOwnershipHeld in user's wallet, burned on close

## Security Model
4-Metal's smart contracts enforce the following at every transaction:

**No undercollateralised minting** — synth_minted ≤ max_mintable at 150% is verified on every mint
**No stale prices** — oracle data must be live for the entire transaction validity window
**No vault identity confusion** — each vault's unique NFT prevents double satisfaction attacks where one output could satisfy multiple vault inputs
**No ownership transfer without consent** — the owner field is preserved across all state transitions
**No liquidating healthy vaults** — collateral ratio must be below 150% before liquidation proceeds
**No oracle manipulation** — Charli3 authentication NFTs verify each feed; the oracle pause mechanism halts the protocol if feeds fail


## Built With

**Aiken** — smart contract language for Cardano Plutus V3
**Charli3** — decentralised oracle network for price feeds
**Mesh SDK** — TypeScript off-chain transaction building
**Cardano** — the settlement layer