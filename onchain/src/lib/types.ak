use aiken/crypto.{VerificationKeyHash}

/// The two synthetic commodity assets supported by the protocol.
pub type AssetClass {
  XAU
  XAG
}

/// Datum stored at the oracle UTXO.
/// All price fields are raw USD values scaled by the oracle's own precision.
/// ada_usd is included to allow on-chain conversion to lovelace-denominated prices.
pub type OracleDatum {
  xau_usd:   Int,
  xag_usd:   Int,
  ada_usd:   Int,
  timestamp: Int,
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
  Withdraw
  Liquidate
}

/// Redeemer for the mint policy.
pub type MintRedeemer {
  MintSynth
  BurnSynth
}
