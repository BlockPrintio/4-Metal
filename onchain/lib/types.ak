use aiken/collection/dict.{Dict}
use aiken/crypto.{VerificationKeyHash}

/// The two synthetic commodity assets supported by the protocol.
pub type AssetClass {
  XAU
  XAG
}

/// Generic data structure for Charli3 aggregate state.
pub type GenericData {
  // Map of String keys to Int values ("0": price, "1": created, "2": expires)
  price_map: Dict<ByteArray, Int>,
}

/// Datum stored at the oracle AGGREGATE UTXO.
pub type OracleDatum {
  OracleAgg { price_map: Dict<ByteArray, Int> }
}

/// Simplified Oracle Settings Datum to check for pause status.
pub type OracleSettingsDatum {
  nodes: Data,
  required_signatures: Int,
  liveness_period: Int,
  uncertainty_agg: Int,
  uncertainty_platform: Int,
  utxo_buffer: Int,
  fee_info: Data,
  pause_period_started_at: Option<Int>,
}

/// Datum stored at every vault UTXO.
pub type VaultDatum {
  owner:             VerificationKeyHash,
  collateral_amount: Int,
  synth_minted:      Int,
  asset_class:       AssetClass,
}

/// Redeemer for the vault validator.
pub type VaultRedeemer {
  Withdraw {
    ada_agg_index: Int,
    asset_agg_index: Int,
    settings_index: Int,
  }
  Liquidate {
    ada_agg_index: Int,
    asset_agg_index: Int,
    settings_index: Int,
  }
}

/// Redeemer for the mint policy.
pub type MintRedeemer {
  MintSynth {
    ada_agg_index: Int,
    asset_agg_index: Int,
    settings_index: Int,
  }
  BurnSynth
}
