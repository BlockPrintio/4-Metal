import { BlockfrostProvider, deserializeDatum } from "@meshsdk/core";
import { FEEDS, ORACLE_MAX_STALENESS_SECONDS, SCALE } from "./config";
import type { OracleFeedDatum, OracleFeedRef, SyntheticAsset } from "./types";

type DataConStr = { alternative: bigint | number; fields: unknown[] };

function asDataConstr(data: unknown): DataConStr {
  const value = data as DataConStr;
  if (!value || !Array.isArray(value.fields)) {
    throw new Error("Invalid datum shape: expected constructor with fields.");
  }
  return value;
}

function asBigInt(value: unknown, label: string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") return BigInt(value);
  throw new Error(`Invalid ${label}: expected integer-compatible value.`);
}

export function assertFeedFresh(datum: OracleFeedDatum): void {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const age = now >= datum.timestamp ? now - datum.timestamp : datum.timestamp - now;
  if (age > ORACLE_MAX_STALENESS_SECONDS) {
    throw new Error(
      `Oracle feed is stale. age=${age.toString()}s max=${ORACLE_MAX_STALENESS_SECONDS.toString()}s`,
    );
  }
}

export async function fetchFeed(
  provider: BlockfrostProvider,
  ref: OracleFeedRef,
): Promise<OracleFeedDatum> {
  const utxo = await provider.fetchUTxO(ref.txHash, ref.outputIndex);
  if (!utxo) {
    throw new Error(`Oracle UTxO not found at ${ref.txHash}#${ref.outputIndex}.`);
  }
  if (!utxo.output.plutusData) {
    throw new Error(`Oracle UTxO ${ref.txHash}#${ref.outputIndex} has no inline datum.`);
  }

  const rawData = deserializeDatum(utxo.output.plutusData);
  const constr = asDataConstr(rawData);
  const alt = asBigInt(constr.alternative, "constructor index");
  if (alt !== 0n || constr.fields.length !== 2) {
    throw new Error("Oracle datum must be constr 0 with [priceScaled, timestamp].");
  }
  const priceScaled = asBigInt(constr.fields[0], "priceScaled");
  const timestamp = asBigInt(constr.fields[1], "timestamp");
  return { priceScaled, timestamp };
}

export async function getUsdPrice(
  provider: BlockfrostProvider,
  ref: OracleFeedRef,
): Promise<bigint> {
  const datum = await fetchFeed(provider, ref);
  assertFeedFresh(datum);
  return datum.priceScaled;
}

export async function getAdaPricePerSynthetic(
  provider: BlockfrostProvider,
  asset: SyntheticAsset,
): Promise<bigint> {
  const syntheticFeed = asset === "sXAU" ? FEEDS.xauUsd : FEEDS.xagUsd;
  const [syntheticUsdScaled, adaUsdScaled] = await Promise.all([
    getUsdPrice(provider, syntheticFeed),
    getUsdPrice(provider, FEEDS.adaUsd),
  ]);
  if (adaUsdScaled <= 0n) {
    throw new Error("ADA/USD oracle price must be positive.");
  }
  return (syntheticUsdScaled * SCALE) / adaUsdScaled;
}
