// ============================================================
// math.ak  —  Fixed-point arithmetic for SynthEx v2
// ============================================================
//
// PRECISION MODEL
// ---------------
// Oracle prices carry 6 implied decimal places.
//   ADA  =     258_000  →  $0.258000
//   XAU  = 3_285_000_000  →  $3285.000000
//   XAG  =    79_676_455  →  $79.676455
//
// unit_price_lovelace = (asset_raw / ada_raw) * 1_000_000
//
// Both raw values share the same 6-decimal denominator — it
// cancels in division. The × 1_000_000 converts ADA → lovelace.
// We keep one PRECISION constant so integer maths stays safe.
// ============================================================

pub const precision: Int = 1_000_000

// ============================================================
// Price conversion
// ============================================================

/// lovelace-per-synth-unit, precision-scaled.
/// asset_raw and ada_raw are raw Charli3 integers (6 dp).
pub fn unit_price(asset_raw: Int, ada_raw: Int) -> Int {
  asset_raw * precision / ada_raw
}

// ============================================================
// Collateral ratio
// ============================================================

/// Collateral ratio as a whole-number percentage.
/// collateral_lovelace / (synth_minted × unit_price_scaled / precision) × 100
pub fn collateral_ratio(
  collateral_lovelace: Int,
  synth_minted: Int,
  unit_price_scaled: Int,
) -> Int {
  if synth_minted == 0 {
    // No debt → infinitely well-collateralised. Return sentinel max so
    // the Liquidate path (current_ratio < 150) never fires on a zero-debt vault.
    999_999
  } else {
    collateral_lovelace * 100 / ( synth_minted * unit_price_scaled / precision )
  }
}

/// Maximum synths mintable while staying at or above `ratio` percent.
/// Inverse of collateral_ratio.
pub fn max_mintable(
  collateral_lovelace: Int,
  unit_price_scaled: Int,
  ratio: Int,
) -> Int {
  collateral_lovelace * 100 * precision / ( unit_price_scaled * ratio )
}

/// Minimum collateral to back `synth_amount` at `ratio` percent.
pub fn min_collateral(
  synth_amount: Int,
  unit_price_scaled: Int,
  ratio: Int,
) -> Int {
  synth_amount * unit_price_scaled * ratio / ( 100 * precision )
}

// ============================================================
// Liquidation claim
// ============================================================

/// Lovelace a liquidator may claim for repaying `synth_debt` units.
/// bonus_bps: 0 = exact debt, 1000 = 10% bonus, 500 = 5% bonus.
pub fn liquidation_claim(
  synth_debt: Int,
  unit_price_scaled: Int,
  bonus_bps: Int,
) -> Int {
  let debt_lovelace = synth_debt * unit_price_scaled / precision
  debt_lovelace * ( 10_000 + bonus_bps ) / 10_000
}

// ============================================================
// Tests
// ============================================================

test unit_price_xag() {
  // XAG $79.676455, ADA $0.258000 → ≈308.823 ADA per XAG
  let result = unit_price(79_676_455, 258_000)
  result >= 308_823_000 && result <= 308_824_000
}

test collateral_ratio_150() {
  collateral_ratio(150 * precision, 1 * precision, 100 * precision) == 150
}

// Zero synths → sentinel max (prevents zero-debt vaults from appearing liquidatable)
test collateral_ratio_zero_synths_is_max() {
  collateral_ratio(10_000_000, 0, 100_000_000) == 999_999
}

test max_mintable_basic() {
  max_mintable(150 * precision, 100 * precision, 150) == 1 * precision
}

test ratio_mintable_inverse() {
  let col   = 300 * precision
  let price = 100 * precision
  let ratio = 150
  collateral_ratio(col, max_mintable(col, price, ratio), price) == ratio
}

test liquidation_claim_10pct() {
  liquidation_claim(1, 100 * precision, 1_000) == 110
}

test liquidation_claim_no_bonus() {
  liquidation_claim(1, 100 * precision, 0) == 100
}

test min_collateral_basic() {
  // 1 token (1M units) at 100 ADA/unit, 150% ratio → need 150 ADA collateral (150M lovelace)
  min_collateral(1 * precision, 100 * precision, 150) == 150 * precision
}
