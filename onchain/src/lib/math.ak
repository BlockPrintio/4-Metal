/// Scaling factor used throughout fixed-point arithmetic.
/// All prices are stored as (real_value * precision).
pub const precision: Int = 1_000_000

/// XAU price denominated in lovelace (scaled by precision).
/// Formula: (xau_usd / ada_usd) * precision
pub fn xau_per_lovelace(xau_usd: Int, ada_usd: Int) -> Int {
  xau_usd * precision / ada_usd
}

/// XAG price denominated in lovelace (scaled by precision).
/// Formula: (xag_usd / ada_usd) * precision
pub fn xag_per_lovelace(xag_usd: Int, ada_usd: Int) -> Int {
  xag_usd * precision / ada_usd
}

/// Collateral ratio as a whole-number percentage (e.g. 150 = 150%).
/// collateral and synth_amount are in lovelace; unit_price is scaled by precision.
pub fn collateral_ratio(collateral: Int, synth_amount: Int, unit_price: Int) -> Int {
  collateral * 100 * precision / (synth_amount * unit_price)
}

/// Maximum synth units mintable given collateral, unit price, and required ratio (e.g. 150).
/// Inverse of collateral_ratio — staying within max_mintable guarantees ratio >= required.
pub fn max_mintable(collateral: Int, unit_price: Int, ratio: Int) -> Int {
  collateral * 100 * precision / (unit_price * ratio)
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

test collateral_ratio_works() {
  // 150 ADA collateral, 1 synth at 100 ADA each → ratio = 150%
  collateral_ratio(150 * precision, 1, 100 * precision) == 150
}

test max_mintable_works() {
  // 150 ADA collateral at 100 ADA/synth with 150% ratio → max 1 synth
  max_mintable(150 * precision, 100 * precision, 150) == 1
}

test ratio_and_mintable_are_inverse() {
  let collateral = 300 * precision
  let price      = 100 * precision
  let ratio      = 150
  let max        = max_mintable(collateral, price, ratio)
  // Minting exactly max_mintable should give collateral_ratio == 150
  collateral_ratio(collateral, max, price) == ratio
}
