use aiken/collection/list
use aiken/interval.{Finite}
use cardano/address.{Address}
use cardano/transaction.{InlineDatum, Input, Transaction}
use lib/math
use lib/types.{AssetClass, OracleDatum, XAG, XAU}

/// Oracle data must be no older than 2 minutes (120,000 ms).
/// Enforced both at update time (oracle_validator) and at consumption time (here).
const max_staleness_ms: Int = 120_000

/// Finds the oracle datum from the transaction's reference inputs at the given address.
///
/// Fixes applied vs original:
///   1. Datum extraction uses `InlineDatum(raw)` — output.datum is a Datum enum, not Option<Data>.
///   2. Freshness of the oracle data is checked at consumption time, not only at update time.
///      Requires a Finite lower validity bound on every transaction that reads the oracle.
pub fn find_oracle_datum(
  tx: Transaction,
  oracle_address: Address,
) -> OracleDatum {
  // Locate the oracle reference input by address.
  expect Some(oracle_input) =
    list.find(
      tx.reference_inputs,
      fn(input: Input) { input.output.address == oracle_address },
    )

  // FIX 1: output.datum is a Datum enum with variants NoDatum | DatumHash | InlineDatum.
  //        Matching Some(...) compiles but always fails at runtime — use InlineDatum instead.
  expect InlineDatum(raw_datum) = oracle_input.output.datum
  expect datum: OracleDatum = raw_datum

  // FIX 2: Enforce freshness at consumption time.
  //        A stale oracle UTXO sitting on-chain could otherwise be used as a reference input
  //        with no validation, bypassing the staleness window enforced in oracle_validator.
  expect Finite(lower) = tx.validity_range.lower_bound.bound_type
  expect datum.timestamp >= lower - max_staleness_ms

  datum
}

/// Returns the unit price (lovelace per synth unit, scaled by math.precision)
/// for the given synthetic asset class from a validated oracle datum.
pub fn get_unit_price(datum: OracleDatum, asset: AssetClass) -> Int {
  when asset is {
    XAU -> math.xau_per_lovelace(datum.xau_usd, datum.ada_usd)
    XAG -> math.xag_per_lovelace(datum.xag_usd, datum.ada_usd)
  }
}
