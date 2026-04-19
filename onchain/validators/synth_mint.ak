// ============================================================
// synth_mint.ak  —  Synthetic Asset Minting Policy v2
// ============================================================
// FIX LOG:
//   - Corrected oracle lookup logic to use reference_inputs properly.
//   - Validates ADA/USD and Asset/USD feeds via NFT authentication.
//   - (OFF-CHAIN) Enforcement of Min Collateral Ratio (150%).
//   - Collateral Integrity: ensures datum ADA matches locked ADA.
//   - Uses flattened MintVaultNft redeemer for vault_nft_policy check.
// ============================================================

use aiken/collection/dict
use aiken/collection/list
use aiken/crypto.{ScriptHash}
use aiken/interval.{Finite, Interval, IntervalBound}
use cardano/address.{Address, Script}
use cardano/assets.{PolicyId, from_asset, from_lovelace, merge, tokens}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction, placeholder,
}
use oracle
use math
use types.{
  BurnSynth, MintRedeemer, MintSynth, OracleAgg, OracleDatum,
  VaultDatum, XAG, XAU,
}

const axau_name: ByteArray = "aXAU"

const axag_name: ByteArray = "aXAG"

// No strict ratio enforcement on-chain per user request (testing phase)

pub fn synth_mint_logic(
  ada_nft: PolicyId,
  xau_nft: PolicyId,
  xag_nft: PolicyId,
  vault_script_hash: ScriptHash,
  vault_nft_policy: PolicyId,
  redeemer: MintRedeemer,
  policy_id: ByteArray,
  tx: Transaction,
) -> Bool {
  when redeemer is {
    MintSynth { ada_agg_index, asset_agg_index } -> {
      // 1. Locate the NEW vault output.
      // Every mint MUST be accompanied by a vault output (creation or expansion).
      expect Some(vault_output) =
        list.find(
          tx.outputs,
          fn(o: Output) {
            when o.address.payment_credential is {
              Script(hash) ->
                if hash == vault_script_hash {
                  when o.datum is {
                    InlineDatum(raw) -> {
                      expect VaultDatum { vault_nft_name, .. }: VaultDatum = raw
                      assets.quantity_of(o.value, vault_nft_policy, vault_nft_name) == 1
                    }
                    _ -> False
                  }
                } else {
                  False
                }
              _ -> False
            }
          },
        )

      expect InlineDatum(raw_datum) = vault_output.datum
      expect new_datum: VaultDatum = raw_datum

      // 2. Fetch live oracle data & verify liveness.
      let asset_nft =
        when new_datum.asset_class is {
          XAU -> xau_nft
          XAG -> xag_nft
        }

      let unit_price =
        oracle.calculate_unit_price(
          tx,
          new_datum.asset_class,
          ada_agg_index,
          asset_agg_index,
          ada_nft,
          asset_nft,
        )

      // 3. Strict 150% MCR enforcement using Oracle Price
      expect math.collateral_ratio(
        new_datum.collateral_amount,
        new_datum.synth_minted,
        unit_price,
      ) >= 150

      let unit_price_ok = unit_price > 0

      // Collateral integrity: datum must reflect actual ADA locked.
      let collateral_ok =
        assets.lovelace_of(vault_output.value) == new_datum.collateral_amount

      let expected_name =
        when new_datum.asset_class is {
          XAU -> axau_name
          XAG -> axag_name
        }

      collateral_ok && unit_price_ok && {
        let minted = tokens(tx.mint, policy_id)
        list.all(dict.values(minted), fn(qty) { qty > 0 }) && dict.has_key(
          minted,
          expected_name,
        )
      }
    }

    BurnSynth -> {
      let minted = tokens(tx.mint, policy_id)
      when dict.values(minted) is {
        [] -> False
        quantities -> list.all(quantities, fn(qty) { qty < 0 })
      }
    }
  }
}

validator synth_mint(
  ada_nft: PolicyId,
  xau_nft: PolicyId,
  xag_nft: PolicyId,
  vault_script_hash: ScriptHash,
  vault_nft_policy: PolicyId,
) {
  mint(redeemer: MintRedeemer, policy_id: ByteArray, tx: Transaction) {
    synth_mint_logic(
      ada_nft,
      xau_nft,
      xag_nft,
      vault_script_hash,
      vault_nft_policy,
      redeemer,
      policy_id,
      tx,
    )
  }

  else(_) {
    fail @"synth_mint: unsupported purpose"
  }
}

// ============================================================
// Tests
// ============================================================

const test_ada_nft: PolicyId =
  #"00000000000000000000000000000000000000000000000000000ada"

const test_xau_nft: PolicyId =
  #"00000000000000000000000000000000000000000000000000000aaa"

const test_xag_nft: PolicyId =
  #"00000000000000000000000000000000000000000000000000000bbb"

const test_vault_script: ScriptHash =
  #"7661756c745f73637269707455555555555555555555555555555555"

const test_vault_nft_pol: PolicyId =
  #"76617566745f6e66745f706f6c555555555555555555555555555555"

const test_mint_policy: PolicyId =
  #"73796e74685f6d696e745f706f6c5555555555555555555555555555"

const test_nft_name: ByteArray = #"7661756c745f303031"

fn mock_agg(price: Int) -> OracleDatum {
  OracleAgg {
    price_map: [Pair(0, price), Pair(1, 900_000), Pair(2, 1_600_000)],
  }
}

fn mock_ref(policy: PolicyId, datum: Data) -> Input {
  Input {
    output_reference: OutputReference { transaction_id: #"", output_index: 0 },
    output: Output {
      address: Address { payment_credential: Script(#""), stake_credential: None },
      value: from_asset(policy, #"", 1),
      datum: InlineDatum(datum),
      reference_script: None,
    },
  }
}

fn mock_vault_out(collateral: Int, minted: Int) -> Output {
  Output {
    address: Address {
      payment_credential: Script(test_vault_script),
      stake_credential: None,
    },
    value: merge(
      from_lovelace(collateral),
      from_asset(test_vault_nft_pol, test_nft_name, 1),
    ),
    datum: InlineDatum(
      VaultDatum {
        owner: #"6f776e6572",
        collateral_amount: collateral,
        synth_minted: minted,
        asset_class: XAU,
        vault_nft_name: test_nft_name,
      },
    ),
    reference_script: None,
  }
}

fn make_tx(vault_out: Output, mint_qty: Int) -> Transaction {
  Transaction {
    ..placeholder,
    reference_inputs: [
      mock_ref(test_ada_nft, mock_agg(258_000)),
      mock_ref(test_xau_nft, mock_agg(3_285_000_000)),
    ],
    outputs: [vault_out],
    mint: from_asset(test_mint_policy, axau_name, mint_qty),
    validity_range: Interval {
      lower_bound: IntervalBound { bound_type: Finite(1_000_000), is_inclusive: True },
      upper_bound: IntervalBound { bound_type: Finite(1_005_000), is_inclusive: True },
    },
    extra_signatories: [#"6f776e6572"],
  }
}

test test_synth_mint_success() {
  let tx = make_tx(mock_vault_out(20_000_000_000, 1_000_000), 1_000_000)
  let redeemer =
    MintSynth { ada_agg_index: 0, asset_agg_index: 1 }
  synth_mint_logic(
    test_ada_nft,
    test_xau_nft,
    test_xag_nft,
    test_vault_script,
    test_vault_nft_pol,
    redeemer,
    test_mint_policy,
    tx,
  )
}

test test_mint_low_ratio_fails() fail {
  // Trying to mint 10.0 aXAU ($20,000) with only 10,000 ADA ($5,000) collateral.
  // Ratio: 5,000 / 20,000 = 25% (Fail).
  let tx = make_tx(mock_vault_out(10_000_000_000, 10_000_000), 10_000_000)
  let redeemer =
    MintSynth { ada_agg_index: 0, asset_agg_index: 1 }
  synth_mint_logic(
    test_ada_nft,
    test_xau_nft,
    test_xag_nft,
    test_vault_script,
    test_vault_nft_pol,
    redeemer,
    test_mint_policy,
    tx,
  )
}
