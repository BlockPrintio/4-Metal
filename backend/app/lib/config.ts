import { readFileSync } from "node:fs";
import path from "node:path";
import {
  resolvePlutusScriptAddress,
  resolveScriptHash,
  stringToHex,
} from "@meshsdk/core";
import type { FeedsConfig, OracleFeedRef } from "./types";

export const NETWORK = "preview" as const;
export const NETWORK_ID = 0;
export const COLLATERAL_RATIO = 150n;
export const SCALE = 1_000_000n;
export const ORACLE_MAX_STALENESS_SECONDS = 120n;

const blockfrostProjectId = process.env.BLOCKFROST_PROJECT_ID_PREVIEW;
if (!blockfrostProjectId) {
  throw new Error("Missing BLOCKFROST_PROJECT_ID_PREVIEW.");
}
export const BLOCKFROST_PROJECT_ID_PREVIEW = blockfrostProjectId;

export const sXAU_ASSET_NAME_HEX = stringToHex("sXAU");
export const sXAG_ASSET_NAME_HEX = stringToHex("sXAG");

type BlueprintValidator = {
  title?: string;
  name?: string;
  compiledCode?: string;
  compiledCodeHex?: string;
  cborHex?: string;
};

type Blueprint = {
  validators?: BlueprintValidator[];
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}.`);
  }
  return value;
}

function readRef(prefix: string): OracleFeedRef {
  return {
    txHash: requireEnv(`FEED_${prefix}_TX`),
    outputIndex: Number.parseInt(requireEnv(`FEED_${prefix}_IDX`), 10),
    feedAddress: requireEnv(`FEED_${prefix}_ADDR`),
  };
}

let feedsCache: FeedsConfig | null = null;
export function getFeeds(): FeedsConfig {
  if (feedsCache) return feedsCache;
  feedsCache = {
    xauUsd: readRef("XAU_USD"),
    xagUsd: readRef("XAG_USD"),
    adaUsd: readRef("ADA_USD"),
  };
  return feedsCache;
}

export const FEEDS: FeedsConfig = new Proxy({} as FeedsConfig, {
  get(_target, key) {
    return getFeeds()[key as keyof FeedsConfig];
  },
});

function resolveContractsPath(): string {
  return path.resolve(process.cwd(), "contracts", "plutus.json");
}

function readBlueprint(): Blueprint {
  const source = readFileSync(resolveContractsPath(), "utf8");
  return JSON.parse(source) as Blueprint;
}

function validatorCbor(v: BlueprintValidator): string {
  const cbor = v.compiledCode ?? v.compiledCodeHex ?? v.cborHex;
  if (!cbor) throw new Error("Validator is missing compiled CBOR.");
  return cbor;
}

function findValidatorByName(
  validators: BlueprintValidator[],
  match: RegExp,
): BlueprintValidator | undefined {
  return validators.find((v) => match.test(`${v.title ?? v.name ?? ""}`));
}

const blueprint = readBlueprint();
const validators = blueprint.validators ?? [];
const vaultValidator =
  findValidatorByName(validators, /vault/i) ?? validators[0];
const mintValidator =
  findValidatorByName(validators, /(mint|policy)/i) ?? validators[1];

if (!vaultValidator || !mintValidator) {
  throw new Error(
    "Could not resolve vault validator and mint policy from contracts/plutus.json.",
  );
}

export const VAULT_SCRIPT_CBOR = validatorCbor(vaultValidator);
export const MINT_POLICY_CBOR = validatorCbor(mintValidator);
export const VAULT_SCRIPT_ADDRESS = resolvePlutusScriptAddress(
  VAULT_SCRIPT_CBOR,
  NETWORK_ID,
);
export const MINT_POLICY_ID = resolveScriptHash(MINT_POLICY_CBOR, "V3");
