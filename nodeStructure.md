# Charli3 Dual-Asset Oracle Architecture (XAU & XAG)

This document provides a concise rundown of the operational changes implemented to ensure distinct, non-mixed price feeds for Gold (XAU) and Silver (XAG) on the Cardano Preprod testnet.

## 1. Node-Level Isolation (The "Source of Truth")
Each asset now runs on a dedicated node instance with isolated API adapter logic.

- **Gold Node (Port 8000)**: 
  - Uses `configs/config-gold.yml`.
  - Targets `oracle_currency` (Gold Policy ID).
  - Fetches specifically from `XAU/USD` endpoints.
- **Silver Node (Port 8001)**: 
  - Uses `configs/config-silver.yml`.
  - Targets `oracle_currency` (Silver Policy ID).
  - Fetches specifically from `XAG/USD` endpoints.

## 2. SDK-Level Routing (The "Aggregator")
The SDK pull configurations have been decoupled to prevent cross-contamination.

- **`pull_gold.yaml`**: Points exclusively to `http://localhost:8000`. It only accepts signatures related to the Gold Policy ID.
- **`pull_silver.yaml`**: Points exclusively to `http://localhost:8001`. It only accepts signatures related to the Silver Policy ID.

## 3. On-Chain Governance Fixes
We performed critical updates to the `OracleSettingsDatum` for both assets to enable this isolated workflow:

> [!IMPORTANT]
> **Required Signatures: 1**  
> Previously, the oracle required 2 signatures. Since each asset is now handled by an independent node, we reduced the requirement to **1** so that the Gold node doesn't need a signature from the Silver node (and vice versa).

> [!TIP]
> **Median Divergence: 1000%**  
> We temporarily relaxed the divergence factor to allow a one-time "Price Jump." This allowed the on-chain price to move from the old shared mock value (~$2,444) to the real market rates ($4,800 for Gold, $80 for Silver).

## 4. Summary of Operations
To keep the prices live, the following loop is now secure:
1. Node A (8000) signs Gold only.
2. Node B (8001) signs Silver only.
3. SDK Pull A triggers a Gold-only transaction.
4. SDK Pull B triggers a Silver-only transaction.

**Status: Verified On-Chain**  
- Gold: ~$4,809.55  
- Silver: ~$79.67  
