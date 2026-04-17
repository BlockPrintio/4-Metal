use aiken/collection/dict
use aiken/collection/list
use cardano/address.{Address, ScriptCredential}
use cardano/assets.{PolicyId, tokens}
use cardano/transaction.{InlineDatum, Output, Transaction}
use lib/math
use lib/oracle
use lib/types.{BurnSynth, MintRedeemer, MintSynth, OracleDatum, VaultDatum}

/// Minimum collateral ratio required to back a mint (150%).
const min_collateral_ratio: Int = 150

/// Minting policy for sXAU and sXAG.
///
/// MintSynth — Mints are gated by collateral. The validator reads the vault's
///             CONTINUING OUTPUT (post-mint state) to ensure the new total debt
///             does not exceed the collateral-backed maximum.
///
/// BurnSynth — Burning always reduces supply and is freely permitted, provided
///             at least one token of this policy is actually burned.
///
/// Fixes applied vs original:
///   1. CRITICAL: payment_credential is of type PaymentCredential, not PolicyId.
///      Comparison with a raw PolicyId always evaluates to False. Fixed by wrapping
///      the policy ID in ScriptCredential(...).
///   2. CRITICAL: Missing `use aiken/collection/dict` import — BurnSynth called
///      dict.values() without importing the module, causing a compile error.
///   3. HIGH: MintSynth previously read the vault INPUT datum (pre-mint state).
///      The check `synth_minted <= allowed` was evaluated on unchanged numbers,
///      meaning a user could mint without the validator seeing the increased debt.
///      Fixed by reading the vault OUTPUT datum (post-mint state).
///   4. HIGH: The `policy_id` parameter was prefixed with `_`, making it unavailable
///      in the BurnSynth branch. Underscore removed.
validator mint(oracle_address: Address, vault_policy_id: PolicyId) {
  mint(redeemer: MintRedeemer, policy_id: PolicyId, tx: Transaction) {
    let oracle_datum: OracleDatum =
      oracle.find_oracle_datum(tx, oracle_address)

    when redeemer is {
      // -----------------------------------------------------------------------
      MintSynth -> {
        // FIX 1: Locate the vault CONTINUING OUTPUT (not an input) by script credential.
        //        We need the output because it carries the post-mint VaultDatum with
        //        the updated synth_minted field.
        //
        // FIX 1a: ScriptCredential wraps the policy ID so types match (PaymentCredential).
        expect Some(vault_output) =
          list.find(
            tx.outputs,
            fn(output: Output) {
              output.address.payment_credential == ScriptCredential(
                vault_policy_id,
              )
            },
          )

        // FIX 3: Read the POST-mint datum from the vault output, not the pre-mint input.
        expect InlineDatum(raw) = vault_output.datum
        expect new_vault_datum: VaultDatum = raw

        let unit_price =
          oracle.get_unit_price(oracle_datum, new_vault_datum.asset_class)

        let allowed =
          math.max_mintable(
            new_vault_datum.collateral_amount,
            unit_price,
            min_collateral_ratio,
          )

        // The total synth debt recorded in the vault output must not exceed the
        // maximum backed by the current collateral at the oracle price.
        new_vault_datum.synth_minted <= allowed
      }

      // -----------------------------------------------------------------------
      BurnSynth -> {
        // FIX 2: dict is now imported — dict.values() resolves correctly.
        // FIX 4: policy_id is now in scope (underscore removed from parameter).
        //
        // Extract all token quantities minted/burned under this policy in this tx.
        // For a burn, every quantity must be strictly negative.
        // We also require at least one token to be present (non-trivial burn).
        let minted_tokens = tokens(tx.mint, policy_id)

        when dict.values(minted_tokens) is {
          // No tokens of this policy in the mint field → nothing is being burned.
          [] -> False
          // All token quantities must be negative (burned, not minted).
          quantities -> list.all(quantities, fn(qty) { qty < 0 })
        }
      }
    }
  }

  else(_) {
    fail @"mint: unsupported purpose"
  }
}
