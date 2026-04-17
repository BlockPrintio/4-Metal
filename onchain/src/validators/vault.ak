use aiken/collection/list
use cardano/address.{Address}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction,
}
use lib/math
use lib/oracle
use lib/types.{Liquidate, OracleDatum, VaultDatum, VaultRedeemer, Withdraw}

/// Minimum collateral ratio (150%) below which a vault is eligible for liquidation.
const min_collateral_ratio: Int = 150

/// Vault validator — holds ADA collateral on behalf of a vault owner.
///
/// Two actions are permitted:
///   Withdraw  — Owner reclaims collateral. The post-withdraw vault state must remain
///               healthy (ratio >= 150%), or the vault must be fully closed (no debt).
///   Liquidate — Anyone can liquidate a vault whose collateral ratio has fallen below 150%.
///               The mint validator (running in the same tx) enforces that synths are burned.
///
/// Fixes applied vs original:
///   1. Withdraw checks the POST-transaction vault output datum, not the pre-tx input datum.
///      Reading the input datum meant the ratio check was performed on unchanged numbers,
///      allowing a user to withdraw collateral without the check reflecting the new state.
///   2. The vault owner field is verified to be unchanged across the transaction.
///   3. Vault closure (no continuing output) is handled explicitly and correctly.
///   4. Liquidation verifies the position is genuinely undercollateralised at the current
///      oracle price. Synth burn enforcement is delegated to the mint validator, which must
///      also be satisfied in any liquidation transaction.
validator vault(oracle_address: Address) {
  spend(
    datum_opt: Option<VaultDatum>,
    redeemer: VaultRedeemer,
    utxo: OutputReference,
    tx: Transaction,
  ) {
    expect Some(datum) = datum_opt

    // Read and validate the oracle (freshness enforced inside find_oracle_datum).
    let oracle_datum: OracleDatum =
      oracle.find_oracle_datum(tx, oracle_address)

    let unit_price = oracle.get_unit_price(oracle_datum, datum.asset_class)

    // Locate this vault's own input to obtain the script address.
    // We need the address so we can find the continuing output.
    expect Some(vault_input) =
      list.find(
        tx.inputs,
        fn(input: Input) { input.output_reference == utxo },
      )
    let vault_address = vault_input.output.address

    when redeemer is {
      // -----------------------------------------------------------------------
      Withdraw -> {
        let signed_by_owner = list.has(tx.extra_signatories, datum.owner)

        // FIX 1: Locate the continuing vault output (may not exist if vault is fully closed).
        let vault_output_opt =
          list.find(
            tx.outputs,
            fn(output: Output) { output.address == vault_address },
          )

        let state_ok =
          when vault_output_opt is {
            // No continuing output → vault is being fully closed.
            // Only safe if all synths were already burned before this tx or in this tx.
            // The mint validator enforces the actual token burn.
            None -> datum.synth_minted == 0

            // Continuing output exists → validate the new vault state.
            Some(vault_output) -> {
              expect InlineDatum(raw) = vault_output.datum
              expect new_datum: VaultDatum = raw

              // FIX 2: Owner must not change in a Withdraw — prevents owner hijacking.
              let owner_preserved = new_datum.owner == datum.owner

              // FIX 1 (continued): Ratio check uses the NEW collateral_amount and synth_minted
              // from the continuing output, not the stale values from the input datum.
              let ratio_ok =
                new_datum.synth_minted == 0 || math.collateral_ratio(
                  new_datum.collateral_amount,
                  new_datum.synth_minted,
                  unit_price,
                ) >= min_collateral_ratio

              and {
                owner_preserved,
                ratio_ok,
              }
            }
          }

        and {
          signed_by_owner,
          state_ok,
        }
      }

      // -----------------------------------------------------------------------
      Liquidate -> {
        let current_ratio =
          math.collateral_ratio(
            datum.collateral_amount,
            datum.synth_minted,
            unit_price,
          )

        // Anyone may liquidate an undercollateralised vault.
        // The mint validator (BurnSynth branch) enforces that the liquidator
        // actually burns the synths — both validators must pass in the same tx.
        current_ratio < min_collateral_ratio
      }
    }
  }

  else(_) {
    fail @"vault: unsupported purpose"
  }
}
