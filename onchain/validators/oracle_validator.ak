use aiken/collection/dict
use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/interval.{Finite}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction,
}
use types.{OracleAgg, OracleDatum}

/// Staleness window: oracle data must be no older than 2 minutes (120,000 ms).
const max_staleness_ms: Int = 120_000

/// Controls when the oracle UTXO can be updated.
/// Only the authorised oracle node (identified by oracle_key) may spend this UTXO.
validator oracle_validator(oracle_key: VerificationKeyHash) {
  spend(
    datum_opt: Option<OracleDatum>,
    _redeemer: Data,
    utxo: OutputReference,
    tx: Transaction,
  ) {
    expect Some(datum) = datum_opt

    // Oracle update must be signed by the authorized key.
    let signed_by_oracle = list.has(tx.extra_signatories, oracle_key)

    // Validity range extraction.
    expect Finite(lower) = tx.validity_range.lower_bound.bound_type

    // Current datum must not be stale (guards against reading from a dead oracle).
    let OracleAgg { price_map } = datum
    expect Some(timestamp) = dict.get(price_map, "1")
    let is_fresh = timestamp >= lower - max_staleness_ms

    // Locate the continuing oracle output.
    expect Some(spent_input) =
      list.find(
        tx.inputs,
        fn(input: Input) { input.output_reference == utxo },
      )
    let oracle_address = spent_input.output.address

    expect Some(oracle_output) =
      list.find(
        tx.outputs,
        fn(output: Output) { output.address == oracle_address },
      )

    // The output datum must be a well-formed OracleDatum.
    expect InlineDatum(raw_out) = oracle_output.datum
    expect OracleAgg { price_map: new_price_map } = raw_out
    expect Some(new_timestamp) = dict.get(new_price_map, "1")

    // The new timestamp must be at or after the lower validity bound.
    let timestamp_valid = new_timestamp >= lower

    and {
      signed_by_oracle,
      is_fresh,
      timestamp_valid,
    }
  }

  else(_) {
    fail @"oracle_validator: unsupported purpose"
  }
}
