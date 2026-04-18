use aiken/collection/dict
use aiken/collection/list
use aiken/interval.{Finite}
use cardano/assets.{PolicyId}
use cardano/transaction.{InlineDatum, Transaction}
use math
use types.{
  AssetClass, OracleAgg, OracleDatum, OracleSettingsDatum, XAG, XAU,
}

/// Finds and verifies an oracle AGGREGATE UTXO by index and NFT policy.
pub fn get_verified_agg_datum(
  tx: Transaction,
  index: Int,
  nft_policy: PolicyId,
) -> OracleDatum {
  expect Some(ref_input) = list.at(tx.reference_inputs, index)

  // 1. Verify Authentication NFT is present on this UTXO.
  //    Charli3 uses unique NFTs (one per asset pair) for security.
  expect True =
    ref_input.output.value
      |> assets.tokens(nft_policy)
      |> dict.is_empty
      |> not

  // 2. Extract and return the OracleDatum.
  expect InlineDatum(raw_datum) = ref_input.output.datum
  expect OracleAgg { price_map } = raw_datum
  OracleAgg { price_map }
}

/// Finds and verifies the oracle SETTINGS UTXO by index and NFT policy.
pub fn get_verified_settings_datum(
  tx: Transaction,
  index: Int,
  nft_policy: PolicyId,
) -> OracleSettingsDatum {
  expect Some(ref_input) = list.at(tx.reference_inputs, index)

  // 1. Verify Settings Authentication NFT.
  expect True =
    ref_input.output.value
      |> assets.tokens(nft_policy)
      |> dict.is_empty
      |> not

  // 2. Extract and return the Settings Datum.
  expect InlineDatum(raw_datum) = ref_input.output.datum
  expect datum: OracleSettingsDatum = raw_datum
  datum
}

/// Validates that the oracle data is currently live (not stale or expired).
/// Uses Map Indices 1 (Created) and 2 (Expires).
pub fn validate_liveness(datum: OracleDatum, tx: Transaction) -> Int {
  let OracleAgg { price_map } = datum
  expect Some(price) = dict.get(price_map, "0")
  expect Some(created_at) = dict.get(price_map, "1")
  expect Some(expires_at) = dict.get(price_map, "2")

  // Enforce timing bounds against validity_range.
  expect Finite(lower) = tx.validity_range.lower_bound.bound_type
  expect Finite(upper) = tx.validity_range.upper_bound.bound_type

  // Logic: 
  // 1. Data must have been created before the tx starts (no future data).
  // 2. Data must not expire before the tx interval ends (must be valid for entire tx).
  expect created_at <= lower
  expect expires_at >= upper

  price
}

/// Validates that the oracle is NOT in a paused state.
pub fn validate_not_paused(datum: OracleSettingsDatum) {
  // If pause_period_started_at is Some(timestamp), the oracle is paused.
  expect None = datum.pause_period_started_at
}

/// Refactored unit price calculation using indexed oracle lookups.
pub fn calculate_unit_price(
  tx: Transaction,
  asset: AssetClass,
  ada_index: Int,
  asset_index: Int,
  settings_index: Int,
  ada_nft: PolicyId,
  asset_nft: PolicyId,
  settings_nft: PolicyId,
) -> Int {
  // 1. Check if Oracle is paused.
  let settings = get_verified_settings_datum(tx, settings_index, settings_nft)
  validate_not_paused(settings)

  // 2. Fetch and validate ADA/USD price.
  let ada_datum = get_verified_agg_datum(tx, ada_index, ada_nft)
  let ada_price = validate_liveness(ada_datum, tx)

  // 3. Fetch and validate Asset/USD price.
  let asset_datum = get_verified_agg_datum(tx, asset_index, asset_nft)
  let asset_price = validate_liveness(asset_datum, tx)

  // 4. Calculate synth price in lovelace.
  when asset is {
    XAU -> math.xau_per_lovelace(asset_price, ada_price)
    XAG -> math.xag_per_lovelace(asset_price, ada_price)
  }
}
