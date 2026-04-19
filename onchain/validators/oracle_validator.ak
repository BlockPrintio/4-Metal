// ============================================================
// oracle_validator.ak  —  Charli3 Oracle Validator (simplified)
// ============================================================
// This validator ensures that oracle price feeds are only updated
// by authorized nodes. Our protocol reads from these UTxOs.
// ============================================================

use aiken/collection/dict
use aiken/collection/list
use cardano/assets
use cardano/assets.{PolicyId}
use cardano/transaction.{Transaction}
use types.{OracleDatum}

validator oracle_validator(node_nft: PolicyId) {
  spend(
    _datum: Option<OracleDatum>,
    _redeemer: Data,
    _utxo: Data,
    tx: Transaction,
  ) {
    // Basic authorization check: updating an oracle feed requires
    // the node authentication NFT.
    list.any(
      tx.inputs,
      fn(input) {
        assets.tokens(input.output.value, node_nft)
          |> dict.is_empty
          |> not
      },
    )
  }

  else(_) {
    fail @"oracle_validator: unsupported purpose"
  }
}
