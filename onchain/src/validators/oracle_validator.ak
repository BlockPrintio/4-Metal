use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/interval.{Finite}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction,
}
use lib/types.{OracleDatum}

/// Staleness window: oracle data must be no older than 2 minutes (120,000 ms).
const max_staleness_ms: Int = 120_000

/// Controls when the oracle UTXO can be updated.
/// Only the authorised oracle node (identified by oracle_key) may spend this UTXO.
///
/// Fixes applied vs original:
///   1. Validity range extraction uses `Finite(lower)` — the bound_type is an
///      IntervalBoundType enum, not an Option. `Some(lower)` compiles but fails at runtime.
///   2. The continuing oracle output is located and its new datum is validated:
///      - It must carry a well-formed OracleDatum (catches corrupt / empty outputs).
///      - Its timestamp must be >= the transaction lower bound (no backdating).
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

    // FIX 1: IntervalBoundType is Finite(v) | NegativeInfinity | PositiveInfinity.
    //        `Some(lower)` will always fail — use the correct variant name.
    expect Finite(lower) = tx.validity_range.lower_bound.bound_type

    // Current datum must not be stale (guards against reading from a dead oracle).
    let is_fresh = datum.timestamp >= lower - max_staleness_ms

    // FIX 2: Locate the continuing oracle output (sent back to the same script address).
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

    // The output datum must be a well-formed OracleDatum (not NoDatum / DatumHash / garbage).
    expect InlineDatum(raw_out) = oracle_output.datum
    expect new_datum: OracleDatum = raw_out

    // The new timestamp must be at or after the lower validity bound — no backdated updates.
    let timestamp_valid = new_datum.timestamp >= lower

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
