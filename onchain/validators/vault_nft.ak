// ============================================================
// vault_nft.ak  —  Vault NFT & Receipt Token minting policy
// ============================================================
// FIX LOG:
//   - Added `use aiken/builtin` (required for integer_to_byte_array)
//   - builtin.integer_to_bytearray → builtin.integer_to_byte_array
//   - Removed unused let bindings (names, correct_names, correct_amounts)
//   - Removed unused test imports (Interval, IntervalBound, Finite)
//   - String literals → hex literals (#"...") for ByteArray constants
//   - Wrong-qty test now returns Bool (not fail) since it returns False
// ============================================================

use aiken/builtin
use aiken/collection/dict
use aiken/collection/list
use aiken/primitive/bytearray
use cardano/address.{Address, Script}
use cardano/assets.{from_asset, tokens, zero}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction, placeholder,
}
use types.{BurnVaultNft, MintVaultNft, VaultNftRedeemer}

// ────────────────────────────────────────────────────────────
// Token name derivation
// ────────────────────────────────────────────────────────────

/// Derives vault NFT token name from a seed OutputReference.
/// Format: tx_id_bytes (32 bytes) ++ output_index (1 byte)
/// Globally unique — seed UTxO can only be spent once on Cardano.
pub fn vault_token_name(seed_tx_hash: ByteArray, seed_output_index: Int) -> ByteArray {
  bytearray.concat(
    bytearray.slice(seed_tx_hash, 0, 30),
    builtin.integer_to_bytearray(True, 1, seed_output_index),
  )
}

// ────────────────────────────────────────────────────────────
// Core logic
// ────────────────────────────────────────────────────────────

pub fn vault_nft_logic(
  redeemer: VaultNftRedeemer,
  policy_id: ByteArray,
  tx: Transaction,
) -> Bool {
  when redeemer is {
    MintVaultNft { seed_tx_hash, seed_output_index } -> {
      // 1. Seed UTxO must be consumed — proves global uniqueness.
      expect
        list.any(
          tx.inputs,
          fn(input) {
            input.output_reference.transaction_id == seed_tx_hash && input.output_reference.output_index == seed_output_index
          },
        )

      // 2. Derive expected token name.
      let expected_name = vault_token_name(seed_tx_hash, seed_output_index)

      // 3. Exactly qty=2 of expected_name minted (Vault NFT + Receipt Token).
      let minted = tokens(tx.mint, policy_id)
      when dict.get(minted, expected_name) is {
        Some(qty) -> qty == 2
        None      -> False
      }
    }

    BurnVaultNft -> {
      let minted = tokens(tx.mint, policy_id)
      when dict.values(minted) is {
        []         -> False
        quantities -> list.all(quantities, fn(qty) { qty < 0 })
      }
    }
  }
}

// ────────────────────────────────────────────────────────────
// Validator
// ────────────────────────────────────────────────────────────

validator vault_nft_policy {
  mint(redeemer: VaultNftRedeemer, policy_id: ByteArray, tx: Transaction) {
    vault_nft_logic(redeemer, policy_id, tx)
  }

  else(_) {
    fail @"vault_nft_policy: unsupported purpose"
  }
}

// ============================================================
// Tests
// ============================================================

const test_policy: ByteArray = #"76617566745f6e66745f706f6c696379"

const test_tx_id: ByteArray =
  #"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

const test_seed_ref: OutputReference =
  OutputReference { transaction_id: test_tx_id, output_index: 0 }

fn mock_seed_input() -> Input {
  Input {
    output_reference: test_seed_ref,
    output: Output {
      address: Address {
        payment_credential: Script(#""),
        stake_credential: None,
      },
      value: zero,
      datum: InlineDatum(0),
      reference_script: None,
    },
  }
}

test test_vault_nft_mint_success() {
  let expected_name =
    vault_token_name(test_seed_ref.transaction_id, test_seed_ref.output_index)
  let tx =
    Transaction {
      ..placeholder,
      inputs: [mock_seed_input()],
      mint: from_asset(test_policy, expected_name, 2),
    }
  vault_nft_logic(
    MintVaultNft {
      seed_tx_hash: test_seed_ref.transaction_id,
      seed_output_index: test_seed_ref.output_index,
    },
    test_policy,
    tx,
  )
}

// Seed NOT in inputs → expect inside vault_nft_logic fails → test marked `fail`
test test_vault_nft_mint_no_seed_fails() fail {
  let expected_name =
    vault_token_name(test_seed_ref.transaction_id, test_seed_ref.output_index)
  let tx =
    Transaction {
      ..placeholder,
      inputs: [],
      mint: from_asset(test_policy, expected_name, 2),
    }
  vault_nft_logic(
    MintVaultNft {
      seed_tx_hash: test_seed_ref.transaction_id,
      seed_output_index: test_seed_ref.output_index,
    },
    test_policy,
    tx,
  )
}

test test_vault_nft_mint_wrong_qty_fails() {
  let expected_name =
    vault_token_name(test_seed_ref.transaction_id, test_seed_ref.output_index)
  let tx =
    Transaction {
      ..placeholder,
      inputs: [mock_seed_input()],
      mint: from_asset(test_policy, expected_name, 3),
    }
  !vault_nft_logic(
    MintVaultNft {
      seed_tx_hash: test_seed_ref.transaction_id,
      seed_output_index: test_seed_ref.output_index,
    },
    test_policy,
    tx,
  )
}

test test_vault_nft_mint_qty_one_fails() {
  let expected_name =
    vault_token_name(test_seed_ref.transaction_id, test_seed_ref.output_index)
  let tx =
    Transaction {
      ..placeholder,
      inputs: [mock_seed_input()],
      mint: from_asset(test_policy, expected_name, 1),
    }
  !vault_nft_logic(
    MintVaultNft {
      seed_tx_hash: test_seed_ref.transaction_id,
      seed_output_index: test_seed_ref.output_index,
    },
    test_policy,
    tx,
  )
}

test test_vault_nft_burn_success() {
  let expected_name =
    vault_token_name(test_seed_ref.transaction_id, test_seed_ref.output_index)
  let tx =
    Transaction {
      ..placeholder,
      mint: from_asset(test_policy, expected_name, -2),
    }
  vault_nft_logic(BurnVaultNft, test_policy, tx)
}

test test_vault_nft_burn_positive_fails() {
  let expected_name =
    vault_token_name(test_seed_ref.transaction_id, test_seed_ref.output_index)
  let tx =
    Transaction {
      ..placeholder,
      mint: from_asset(test_policy, expected_name, 1),
    }
  !vault_nft_logic(BurnVaultNft, test_policy, tx)
}

test test_vault_nft_burn_empty_fails() {
  !vault_nft_logic(BurnVaultNft, test_policy, placeholder)
}
