// ============================================================
//
// THREADED TOKEN MODEL
// --------------------
// Every vault position is identified by a unique NFT pair minted
// at creation time from vault_nft_policy:
//
//   token_name = sha2_256(seed_tx_hash ++ seed_output_index)
//   (in practice: just the seed OutputReference serialised to bytes)
//
//   Vault NFT    (qty 1) → lives at vault UTxO  (proves authenticity)
//   Receipt Token (qty 1) → lives in owner wallet (proves ownership)
//
// Both are burned when the vault is closed. The vault datum stores
// vault_nft_name so vault_router can look up the EXACT continuing
// output by NFT presence rather than address, defeating double
// satisfaction attacks.
//
// DOUBLE SATISFACTION FIX
// -----------------------
// Old (broken): list.find outputs by address  → multiple vaults
//               at same address share a match
// New (fixed):  list.find outputs by vault_nft_name in value  → 
//               each NFT is unique, each input maps to exactly
//               one output
// ============================================================

use aiken/crypto.{VerificationKeyHash}

// ============================================================
// ASSET CLASSES
// ============================================================

pub type AssetClass {
  XAU  // Synthetic Gold   → aXAU
  XAG  // Synthetic Silver → aXAG
}

// ============================================================
// ORACLE TYPES  (Charli3 Aggregate Feed)
//
// Datum layout (constructor 0 > constructor 2 > price_map):
//   "0" → price      in USD, 6 decimal places  (258000 = $0.258)
//   "1" → created_at in POSIX milliseconds
//   "2" → expires_at in POSIX milliseconds
// ============================================================

pub type OracleAggPriceMap =
  Pairs<Int, Int>

pub type OracleDatum {
  OracleAgg { price_map: OracleAggPriceMap }
}

// ============================================================
// VAULT
// ============================================================

/// Datum stored at every vault UTxO.
///
/// vault_nft_name: the token name of the Vault NFT (and Receipt Token)
///   minted for this specific vault. Used by vault_router to match
///   each input to its unique continuing output — defeating double
///   satisfaction attacks.
pub type VaultDatum {
  owner: VerificationKeyHash,
  collateral_amount: Int,
  synth_minted: Int,
  asset_class: AssetClass,
  /// ByteArray token name shared by the Vault NFT and Receipt Token.
  /// Derived from the seed UTxO ref at vault creation time.
  vault_nft_name: ByteArray,
}

/// Redeemer for the vault spend validator (thin router).
pub type VaultRedeemer {
  Withdraw { ada_agg_index: Int, asset_agg_index: Int }
  Liquidate { ada_agg_index: Int, asset_agg_index: Int }
}

// ============================================================
// VAULT NFT POLICY
// ============================================================

/// Redeemer for the vault_nft minting policy.
pub type VaultNftRedeemer {
  /// Mint: provide the seed UTxO ref that generates the unique token name.
  MintVaultNft {
    seed_tx_hash: ByteArray,
    seed_output_index: Int,
  }
  /// Burn: both Vault NFT and Receipt Token are destroyed on closure.
  BurnVaultNft
}

// ============================================================
// MINT POLICY
// ============================================================

pub type MintRedeemer {
  MintSynth { ada_agg_index: Int, asset_agg_index: Int }
  BurnSynth
}

// ============================================================
// WITHDRAWAL VALIDATOR
// ============================================================

// (Withdrawal validator uses shared VaultRedeemer from L89)
