import {
  BlockfrostProvider,
  MeshTxBuilder,
  deserializeDatum,
  deserializeAddress,
  mConStr0,
  mConStr1,
  mConStr2,
  stringToHex,
  type Data,
} from "@meshsdk/core";
import type { UTxO } from "@meshsdk/common";
import {
  BLOCKFROST_PROJECT_ID_PREVIEW,
  FEEDS,
  MINT_POLICY_ID,
  NETWORK,
  VAULT_SCRIPT_ADDRESS,
} from "./config";
import type {
  MintRedeemer,
  SyntheticAsset,
  VaultDatum,
  VaultRedeemer,
} from "./types";

export function makeLogger(scope: string) {
  return (message: string, context?: Record<string, unknown>) => {
    const ts = new Date().toISOString();
    const base = `[${ts}] [${scope}] ${message}`;
    if (!context) {
      console.log(base);
      return;
    }
    console.log(`${base} ${JSON.stringify(context)}`);
  };
}

export function getMeshProvider() {
  return new BlockfrostProvider(BLOCKFROST_PROJECT_ID_PREVIEW, NETWORK);
}

export function getProvider() {
  return getMeshProvider();
}

export function getTxBuilder() {
  const provider = getProvider();
  return new MeshTxBuilder({
    fetcher: provider,
    submitter: provider,
  });
}

export function ownerPkhFromAddress(changeAddress: string): string {
  const { pubKeyHash } = deserializeAddress(changeAddress);
  if (!pubKeyHash) {
    throw new Error("Could not derive owner pub key hash from wallet address.");
  }
  return pubKeyHash;
}

export function buildVaultDatum(datum: VaultDatum): Data {
  const assetBytes = stringToHex(datum.syntheticAsset);
  return mConStr0([
    datum.owner,
    assetBytes,
    datum.collateralLovelace,
    datum.mintedAmount,
    datum.mintPriceAdaScaled,
  ]);
}

export function parseVaultDatum(inlineDatum: string): VaultDatum {
  const raw = deserializeDatum(inlineDatum) as {
    alternative: bigint | number;
    fields: unknown[];
  };
  const alt = typeof raw.alternative === "bigint" ? raw.alternative : BigInt(raw.alternative);
  if (alt !== 0n || raw.fields.length !== 5) {
    throw new Error("Vault datum must be constr 0 with 5 fields.");
  }

  const owner = String(raw.fields[0]);
  const syntheticHex = String(raw.fields[1]).toLowerCase();
  const sXauHex = stringToHex("sXAU").toLowerCase();
  const sXagHex = stringToHex("sXAG").toLowerCase();
  const syntheticAsset: SyntheticAsset =
    syntheticHex === sXauHex ? "sXAU" : syntheticHex === sXagHex ? "sXAG" : (() => {
      throw new Error(`Unknown synthetic asset hex in datum: ${syntheticHex}`);
    })();

  return {
    owner,
    syntheticAsset,
    collateralLovelace: BigInt(raw.fields[2] as bigint | number | string),
    mintedAmount: BigInt(raw.fields[3] as bigint | number | string),
    mintPriceAdaScaled: BigInt(raw.fields[4] as bigint | number | string),
  };
}

export function buildVaultRedeemer(redeemer: VaultRedeemer): Data {
  switch (redeemer.kind) {
    case "Mint":
      return mConStr0([]);
    case "Burn":
      return mConStr1([redeemer.burnAmount]);
    case "Liquidate":
      return mConStr2([]);
    default:
      throw new Error(`Unhandled vault redeemer kind: ${(redeemer as VaultRedeemer).kind}`);
  }
}

export function buildMintRedeemer(redeemer: MintRedeemer): Data {
  const assetBytes = stringToHex(redeemer.asset);
  switch (redeemer.kind) {
    case "MintTokens":
      return mConStr0([redeemer.amount, assetBytes]);
    case "BurnTokens":
      return mConStr1([redeemer.amount, assetBytes]);
    default:
      throw new Error(`Unhandled mint redeemer kind: ${(redeemer as MintRedeemer).kind}`);
  }
}

export async function findVaultUtxoForOwner(
  provider: BlockfrostProvider,
  ownerPkh: string,
  asset: SyntheticAsset,
): Promise<{ utxo: UTxO; datum: VaultDatum }> {
  const utxos = await provider.fetchAddressUTxOs(VAULT_SCRIPT_ADDRESS);
  for (const utxo of utxos) {
    const inline = utxo.output.plutusData;
    if (!inline) continue;
    try {
      const datum = parseVaultDatum(inline);
      if (datum.owner === ownerPkh && datum.syntheticAsset === asset) {
        return { utxo, datum };
      }
    } catch {
      continue;
    }
  }
  throw new Error(`no vault found for owner ${ownerPkh} and asset ${asset}`);
}

export function attachOracleReferenceInputs(txBuilder: MeshTxBuilder) {
  txBuilder.readOnlyTxInReference(FEEDS.xauUsd.txHash, FEEDS.xauUsd.outputIndex);
  txBuilder.readOnlyTxInReference(FEEDS.xagUsd.txHash, FEEDS.xagUsd.outputIndex);
  txBuilder.readOnlyTxInReference(FEEDS.adaUsd.txHash, FEEDS.adaUsd.outputIndex);
  return txBuilder;
}

export function syntheticUnit(asset: SyntheticAsset): string {
  return `${MINT_POLICY_ID}${stringToHex(asset)}`;
}
