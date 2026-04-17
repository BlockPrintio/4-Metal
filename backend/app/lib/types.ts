export type SyntheticAsset = "sXAU" | "sXAG";

export type VaultDatum = {
  owner: string;
  syntheticAsset: SyntheticAsset;
  collateralLovelace: bigint;
  mintedAmount: bigint;
  mintPriceAdaScaled: bigint;
};

export type VaultRedeemer =
  | { kind: "Mint" }
  | { kind: "Burn"; burnAmount: bigint }
  | { kind: "Liquidate" };

export type MintRedeemer =
  | { kind: "MintTokens"; amount: bigint; asset: SyntheticAsset }
  | { kind: "BurnTokens"; amount: bigint; asset: SyntheticAsset };

export type OracleFeedDatum = {
  priceScaled: bigint;
  timestamp: bigint;
};

export type OracleFeedRef = {
  txHash: string;
  outputIndex: number;
  feedAddress: string;
};

export type FeedsConfig = {
  xauUsd: OracleFeedRef;
  xagUsd: OracleFeedRef;
  adaUsd: OracleFeedRef;
};
