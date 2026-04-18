use aiken/collection/dict
use aiken/collection/list
use aiken/interval.{Finite, Interval, IntervalBound}
use cardano/address.{Address, Script}
use cardano/assets.{PolicyId, from_asset, tokens, zero}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction,
  placeholder,
}
use math
use oracle
use types.{
  BurnSynth, MintRedeemer, MintSynth, OracleAgg, OracleDatum,
  OracleSettingsDatum, VaultDatum, XAG, XAU,
}

/// Minimum collateral ratio required to back a mint (150%).
const min_collateral_ratio: Int = 150

/// Core logic for synth minting, extracted for easier testing.
pub fn synth_mint_logic(
  ada_nft: PolicyId,
  xau_nft: PolicyId,
  xag_nft: PolicyId,
  settings_nft: PolicyId,
  vault_policy_id: PolicyId,
  redeemer: MintRedeemer,
  policy_id: PolicyId,
  tx: Transaction,
) -> Bool {
  when redeemer is {
    // -----------------------------------------------------------------------
    MintSynth { ada_agg_index, asset_agg_index, settings_index } -> {
      // 1. Locate the vault CONTINUING OUTPUT (post-mint state).
      expect Some(vault_output) =
        list.find(
          tx.outputs,
          fn(output: Output) {
            output.address.payment_credential == Script(vault_policy_id)
          },
        )

      // 2. Read the POST-mint datum from the vault output.
      expect InlineDatum(raw) = vault_output.datum
      expect new_vault_datum: VaultDatum = raw

      // 3. Determine which asset oracle NFT to use.
      let asset_nft =
        when new_vault_datum.asset_class is {
          XAU -> xau_nft
          XAG -> xag_nft
        }

      // 4. Calculate the current unit price in lovelace using indexed lookups.
      let unit_price =
        oracle.calculate_unit_price(
          tx,
          new_vault_datum.asset_class,
          ada_agg_index,
          asset_agg_index,
          settings_index,
          ada_nft,
          asset_nft,
          settings_nft,
        )

      // 5. Enforce collateralization.
      let allowed =
        math.max_mintable(
          new_vault_datum.collateral_amount,
          unit_price,
          min_collateral_ratio,
        )

      new_vault_datum.synth_minted <= allowed
    }

    // -----------------------------------------------------------------------
    BurnSynth -> {
      let minted_tokens = tokens(tx.mint, policy_id)
      when dict.values(minted_tokens) is {
        [] -> False
        quantities -> list.all(quantities, fn(qty) { qty < 0 })
      }
    }
  }
}

/// Minting policy for aXAU and aXAG.
validator synth_mint(
  ada_nft: PolicyId,
  xau_nft: PolicyId,
  xag_nft: PolicyId,
  settings_nft: PolicyId,
  vault_policy_id: PolicyId,
) {
  mint(redeemer: MintRedeemer, policy_id: PolicyId, tx: Transaction) {
    synth_mint_logic(
      ada_nft,
      xau_nft,
      xag_nft,
      settings_nft,
      vault_policy_id,
      redeemer,
      policy_id,
      tx,
    )
  }

  else(_) {
    fail @"mint: unsupported purpose"
  }
}

// --- Constants / Mock Data ---

const test_ada_nft: PolicyId = "ada_nft"
const test_xau_nft: PolicyId = "xau_nft"
const test_xag_nft: PolicyId = "xag_nft"
const test_settings_nft: PolicyId = "settings_nft"
const test_vault_policy: PolicyId = "vault_policy"
const test_mint_policy: PolicyId = "mint_policy"

// --- Helpers ---

fn mock_agg_datum(price: Int, created: Int, expires: Int) -> OracleDatum {
  let price_map =
    dict.empty
      |> dict.insert("0", price)
      |> dict.insert("1", created)
      |> dict.insert("2", expires)
  OracleAgg { price_map }
}

fn mock_settings_datum(paused_at: Option<Int>) -> OracleSettingsDatum {
  OracleSettingsDatum {
    nodes: 0,
    required_signatures: 1,
    liveness_period: 600000,
    uncertainty_agg: 120000,
    uncertainty_platform: 180000,
    utxo_buffer: 7500000,
    fee_info: 0,
    pause_period_started_at: paused_at,
  }
}

fn mock_reference_input(
  policy: PolicyId,
  name: ByteArray,
  datum: Data,
) -> Input {
  Input {
    output_reference: OutputReference { transaction_id: "", output_index: 0 },
    output: Output {
      address: Address {
        payment_credential: Script(""),
        stake_credential: None,
      },
      value: from_asset(policy, name, 1),
      datum: InlineDatum(datum),
      reference_script: None,
    },
  }
}

fn mock_validity_range(lower: Int, upper: Int) -> Interval<Int> {
  Interval {
    lower_bound: IntervalBound { bound_type: Finite(lower), is_inclusive: True },
    upper_bound: IntervalBound { bound_type: Finite(upper), is_inclusive: True },
  }
}

fn mock_vault_output(collateral: Int, minted: Int) -> Output {
  Output {
    address: Address {
      payment_credential: Script(test_vault_policy),
      stake_credential: None,
    },
    value: zero,
    datum: InlineDatum(
      VaultDatum {
        owner: "owner",
        collateral_amount: collateral,
        synth_minted: minted,
        asset_class: XAU,
      },
    ),
    reference_script: None,
  }
}

// --- Test Cases ---

test test_mint_success() {
  let ada_price = 500_000 // 0.5 USD per ADA
  let xau_price = 2_500_000_000 // 2500 USD per XAU
  // unit_price = xau / ada = 5000 ADA per XAU

  let ada_agg = mock_agg_datum(ada_price, 900_000, 1_600_000)
  let xau_agg = mock_agg_datum(xau_price, 900_000, 1_600_000)
  let settings = mock_settings_datum(None)

  let ref_inputs =
    [
      mock_reference_input(test_ada_nft, "", ada_agg),
      mock_reference_input(test_xau_nft, "", xau_agg),
      mock_reference_input(test_settings_nft, "", settings),
    ]

  // 10,000 ADA collateral, 1 XAU minted.
  // unit_price = 5000 ADA/XAU. 
  // Ratio = 10,000 / (1 * 5000) = 200%. OK (>150%).
  let tx =
    Transaction {
      ..placeholder,
      reference_inputs: ref_inputs,
      outputs: [mock_vault_output(10_000, 1)],
      validity_range: mock_validity_range(1_000_000, 1_005_000),
    }

  let redeemer =
    MintSynth { ada_agg_index: 0, asset_agg_index: 1, settings_index: 2 }

  synth_mint_logic(
    test_ada_nft,
    test_xau_nft,
    test_xag_nft,
    test_settings_nft,
    test_vault_policy,
    redeemer,
    test_mint_policy,
    tx,
  )
}

test test_mint_stale_price_fails() fail {
  let ada_agg = mock_agg_datum(500_000, 900_000, 999_999) // EXPIRED before 1,000,000
  let xau_agg = mock_agg_datum(2_500_000_000, 900_000, 1_600_000)
  let settings = mock_settings_datum(None)

  let tx =
    Transaction {
      ..placeholder,
      reference_inputs: [
        mock_reference_input(test_ada_nft, "", ada_agg),
        mock_reference_input(test_xau_nft, "", xau_agg),
        mock_reference_input(test_settings_nft, "", settings),
      ],
      outputs: [mock_vault_output(10_000, 1)],
      validity_range: mock_validity_range(1_000_000, 1_005_000),
    }

  let redeemer =
    MintSynth { ada_agg_index: 0, asset_agg_index: 1, settings_index: 2 }

  synth_mint_logic(
    test_ada_nft,
    test_xau_nft,
    test_xag_nft,
    test_settings_nft,
    test_vault_policy,
    redeemer,
    test_mint_policy,
    tx,
  )
}

test test_mint_paused_fails() fail {
  let ada_agg = mock_agg_datum(500_000, 900_000, 1_600_000)
  let xau_agg = mock_agg_datum(2_500_000_000, 900_000, 1_600_000)
  let settings = mock_settings_datum(Some(950_000)) // PAUSED

  let tx =
    Transaction {
      ..placeholder,
      reference_inputs: [
        mock_reference_input(test_ada_nft, "", ada_agg),
        mock_reference_input(test_xau_nft, "", xau_agg),
        mock_reference_input(test_settings_nft, "", settings),
      ],
      outputs: [mock_vault_output(10_000, 1)],
      validity_range: mock_validity_range(1_000_000, 1_005_000),
    }

  let redeemer =
    MintSynth { ada_agg_index: 0, asset_agg_index: 1, settings_index: 2 }

  synth_mint_logic(
    test_ada_nft,
    test_xau_nft,
    test_xag_nft,
    test_settings_nft,
    test_vault_policy,
    redeemer,
    test_mint_policy,
    tx,
  )
}

test test_mint_insufficient_collateral_fails() {
  let ada_price = 500_000
  let xau_price = 2_500_000_000

  let ada_agg = mock_agg_datum(ada_price, 900_000, 1_600_000)
  let xau_agg = mock_agg_datum(xau_price, 900_000, 1_600_000)
  let settings = mock_settings_datum(None)

  // 6,000 ADA collateral, 1 XAU minted.
  // unit_price = 5000 ADA/XAU. 
  // Ratio = 6,000 / 5,000 = 120%. FAIL (<150%).
  let tx =
    Transaction {
      ..placeholder,
      reference_inputs: [
        mock_reference_input(test_ada_nft, "", ada_agg),
        mock_reference_input(test_xau_nft, "", xau_agg),
        mock_reference_input(test_settings_nft, "", settings),
      ],
      outputs: [mock_vault_output(6_000, 1)],
      validity_range: mock_validity_range(1_000_000, 1_005_000),
    }

  let redeemer =
    MintSynth { ada_agg_index: 0, asset_agg_index: 1, settings_index: 2 }

  !synth_mint_logic(
    test_ada_nft,
    test_xau_nft,
    test_xag_nft,
    test_settings_nft,
    test_vault_policy,
    redeemer,
    test_mint_policy,
    tx,
  )
}

test test_mint_wrong_nft_fails() fail {
  let ada_agg = mock_agg_datum(500_000, 900_000, 1_600_000)
  let xau_agg = mock_agg_datum(2_500_000_000, 900_000, 1_600_000)
  let settings = mock_settings_datum(None)

  let tx =
    Transaction {
      ..placeholder,
      reference_inputs: [
        mock_reference_input("fake_policy", "", ada_agg), // WRONG NFT
        mock_reference_input(test_xau_nft, "", xau_agg),
        mock_reference_input(test_settings_nft, "", settings),
      ],
      outputs: [mock_vault_output(10_000, 1)],
      validity_range: mock_validity_range(1_000_000, 1_005_000),
    }

  let redeemer =
    MintSynth { ada_agg_index: 0, asset_agg_index: 1, settings_index: 2 }

  synth_mint_logic(
    test_ada_nft,
    test_xau_nft,
    test_xag_nft,
    test_settings_nft,
    test_vault_policy,
    redeemer,
    test_mint_policy,
    tx,
  )
}
