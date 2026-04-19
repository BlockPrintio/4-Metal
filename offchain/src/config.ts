// ============================================================
// config.ts  —  4-Metal Protocol Configuration
// ============================================================
// All oracle NFT policies and protocol constants in one place.
// Override via .env for different environments.
// ============================================================

export type Network = "preprod" | "mainnet";

// ── Oracle NFT policy IDs (Charli3) ─────────────────────────
// These are the authentication NFTs that live on Charli3 oracle UTxOs.
// The on-chain validators check for these to prevent oracle spoofing.
export const ORACLE_CONFIG = {
  ADA_NFT_POLICY:      process.env.ADA_NFT_POLICY      ?? "886dcb2363e160c944e63cf544ce6f6265b22ef7c4e2478dd975078e",
  XAU_NFT_POLICY:      process.env.XAU_NFT_POLICY      ?? "63fb25158563dd7e45300fe997604f00579f14dacc3edc414e8d8755",
  XAG_NFT_POLICY:      process.env.XAG_NFT_POLICY      ?? "598c7c94f56a456b01d31139d33fa3392266dd1eec7fc2e115283fc8",

  ADA_ORACLE_ADDRESS:  process.env.ADA_ORACLE_ADDRESS  ?? "addr_test1wq3pacs7jcrlwehpuy3ryj8kwvsqzjp9z6dpmx8txnr0vkq6vqeuu",
  XAU_ORACLE_ADDRESS:  process.env.XAU_ORACLE_ADDRESS  ?? "addr_test1wr85y8c4gh7gdugdewhdrgfgjgcl3utxrqfpgk5j85kdv4svjyshw",
  XAG_ORACLE_ADDRESS:  process.env.XAG_ORACLE_ADDRESS  ?? "addr_test1wr85y8c4gh7gdugdewhdrgfgjgcl3utxrqfpgk5j85kdv4svjyshw",

  // Asset names: C3AS = Aggregate Feed
  ADA_ORACLE_NAME:      process.env.ADA_ORACLE_NAME      ?? "43334153",
  XAU_ORACLE_NAME:      process.env.XAU_ORACLE_NAME      ?? "43334153",
  XAG_ORACLE_NAME:      process.env.XAG_ORACLE_NAME      ?? "43334153",
} as const;

// ── Protocol parameters ───────────────────────────────────────
export const PROTOCOL = {
  NETWORK:                (process.env.NETWORK ?? "preprod") as Network,
  NETWORK_ID:             process.env.NETWORK === "mainnet" ? 1 : 0,
  LIQUIDATION_BONUS_BPS:  Number(process.env.LIQUIDATION_BONUS_BPS ?? 1000), // 10%
  MIN_COLLATERAL_RATIO:   150,  // 150% — must match on-chain constant
  PRECISION:              1_000_000n,
} as const;

// ── Fixed-precision math (mirrors math.ak exactly) ──────────────
// unit_price: lovelace per 1 synth unit (precision-scaled)
export function unitPrice(assetRaw: bigint, adaRaw: bigint): bigint {
  return (assetRaw * PROTOCOL.PRECISION) / adaRaw;
}

// collateralRatio: whole-number percentage
export function collateralRatio(
  collateralLovelace: bigint,
  synthMinted: bigint,
  unitPriceScaled: bigint,
): bigint {
  if (synthMinted === 0n) return 999_999n;
  return (collateralLovelace * 100n) / ((synthMinted * unitPriceScaled) / PROTOCOL.PRECISION);
}

export function maxMintable(collateralLovelace: bigint, unitPriceScaled: bigint, ratio: bigint): bigint {
  return (collateralLovelace * 100n * PROTOCOL.PRECISION) / (unitPriceScaled * ratio);
}

export function minCollateral(synthAmount: bigint, unitPriceScaled: bigint, ratio: bigint): bigint {
  return (synthAmount * unitPriceScaled * ratio) / (100n * PROTOCOL.PRECISION);
}

// ── Synth token names (hex-encoded ASCII) ────────────────────
// "aXAU" → 61584155,  "aXAG" → 61584147
export const SYNTH_NAMES = {
  XAU: "61584155",
  XAG: "61584147",
} as const;

// ── Deployed script reference UTxOs ──────────────────────────
// [DEPRECATED] No longer needed for self-contained transactions.
// Embedded scripts are now preferred to avoid reference UTxO overhead.