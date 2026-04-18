use aiken/collection/list
use cardano/assets.{PolicyId}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction,
}
use math
use oracle
use types.{Liquidate, VaultDatum, VaultRedeemer, Withdraw, XAG, XAU}

/// Minimum collateral ratio (150%) below which a vault is eligible for liquidation.
const min_collateral_ratio: Int = 150

/// Vault validator — holds ADA collateral on behalf of a vault owner.
///
/// Refactored to use Charli3 professional oracle patterns:
/// 1. Redeemer Indexing: Oracle UTXOs are found via indices in the redeemer.
/// 2. NFT Verification: Oracle UTXOs are verified by Authentication NFTs.
/// 3. Timing Bounds: Aggregation liveness (10m) is strictly enforced.
/// 4. Pause Check: The oracle settings UTXO is checked for a paused state.
validator vault(
  ada_nft: PolicyId,
  xau_nft: PolicyId,
  xag_nft: PolicyId,
  settings_nft: PolicyId,
) {
  spend(
    datum_opt: Option<VaultDatum>,
    redeemer: VaultRedeemer,
    utxo: OutputReference,
    tx: Transaction,
  ) {
    expect Some(datum) = datum_opt

    // Determine which asset oracle NFT to use based on vault's asset class.
    let asset_nft =
      when datum.asset_class is {
        XAU -> xau_nft
        XAG -> xag_nft
      }

    // Extract indices from the redeemer.
    let (ada_idx, asset_idx, set_idx) =
      when redeemer is {
        Withdraw { ada_agg_index, asset_agg_index, settings_index } ->
          (ada_agg_index, asset_agg_index, settings_index)
        Liquidate { ada_agg_index, asset_agg_index, settings_index } ->
          (ada_agg_index, asset_agg_index, settings_index)
      }

    // Calculate the current unit price in lovelace using indexed lookups.
    let unit_price =
      oracle.calculate_unit_price(
        tx,
        datum.asset_class,
        ada_idx,
        asset_idx,
        set_idx,
        ada_nft,
        asset_nft,
        settings_nft,
      )

    // Locate this vault's own input to obtain the script address.
    expect Some(vault_input) = list.find(tx.inputs, fn(i) { i.output_reference == utxo })
    let vault_address = vault_input.output.address

    when redeemer is {
      // -----------------------------------------------------------------------
      Withdraw { .. } -> {
        let signed_by_owner = list.has(tx.extra_signatories, datum.owner)

        // Locate the continuing vault output (may not exist if vault is fully closed).
        let vault_output_opt =
          list.find(tx.outputs, fn(output) { output.address == vault_address })

        let state_ok =
          when vault_output_opt is {
            None -> datum.synth_minted == 0
            Some(vault_output) -> {
              expect InlineDatum(raw) = vault_output.datum
              expect new_datum: VaultDatum = raw
              let owner_preserved = new_datum.owner == datum.owner
              let ratio_ok =
                new_datum.synth_minted == 0 || math.collateral_ratio(
                  new_datum.collateral_amount,
                  new_datum.synth_minted,
                  unit_price,
                ) >= min_collateral_ratio

              owner_preserved && ratio_ok
            }
          }

        signed_by_owner && state_ok
      }

      // -----------------------------------------------------------------------
      Liquidate { .. } -> {
        let current_ratio =
          math.collateral_ratio(
            datum.collateral_amount,
            datum.synth_minted,
            unit_price,
          )

        current_ratio < min_collateral_ratio
      }
    }
  }

  else(_) {
    fail @"vault: unsupported purpose"
  }
}
