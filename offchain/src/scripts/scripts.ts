// ============================================================
// scripts.ts  —  Parameter application & script hash derivation
// ============================================================
// Applies Plutus V3 parameters to compiled validators.
// Each function returns { hash, cbor, plutusScript } ready for
// MeshTxBuilder .mintTxInReference / .spendingTxInReference.
// ============================================================

import {
  applyParamsToScript,
  resolveScriptHash,
  serializePlutusScript,
  PlutusScript,
} from "@meshsdk/core";
import cbor from "cbor";

import blueprint from "./blueprint.json" with { type: "json" };

// ── Helpers ───────────────────────────────────────────────────

function getRaw(title: string): string {
  const v = (blueprint.validators as any[]).find(x => x.title === title);
  if (!v) throw new Error(`Blueprint validator not found: ${title}`);
  const code = v.compiledCode as string;
  if (!code || code.includes("...")) {
    throw new Error(
      `Blueprint compiledCode for "${title}" is missing or truncated (placeholder "..."). ` +
        "Rebuild on-chain and refresh this file:\n" +
        "  cd onchain && aiken build && cp plutus.json ../offchain/src/scripts/blueprint.json",
    );
  }
  if (!/^[0-9a-fA-F]+$/.test(code)) {
    throw new Error(`Blueprint compiledCode for "${title}" must be hex only.`);
  }
  return code;
}

function makeScript(cbor: string): { hash: string; cbor: string; plutusScript: PlutusScript } {
  const plutusScript: PlutusScript = { code: cbor, version: "V3" };
  const hash = resolveScriptHash(cbor, "V3");
  return { hash, cbor, plutusScript };
}

// ── Vault NFT Policy (no parameters) ─────────────────────────
export function vaultNftPolicy() {
  const __cbor = getRaw("vault_nft.vault_nft_policy.mint");
  const _cbor = cbor.encode(Buffer.from(__cbor, "hex")).toString("hex");
  return makeScript(_cbor);
}

// ── Vault Router (6 parameters) ───────────────────────────────
export interface VaultRouterParams {
  adaNft:              string;
  xauNft:              string;
  xagNft:              string;
  vaultNftPolicy:      string;
  liquidationBonusBps: number;
}

export function vaultRouter(params: VaultRouterParams) {
  const raw = getRaw("vault.vault_router.withdraw");
  const cbor = applyParamsToScript(raw, [
    params.adaNft,
    params.xauNft,
    params.xagNft,
    params.vaultNftPolicy,
    params.liquidationBonusBps,
  ]);
  return makeScript(cbor);
}

// ── Vault Spend (1 parameter: router hash) ────────────────────
export function vaultSpend(routerHash: string) {
  const raw = getRaw("vault.vault_spend.spend");
  const cbor = applyParamsToScript(raw, [routerHash]);
  return makeScript(cbor);
}

// ── Synth Mint Policy (6 parameters) ─────────────────────────
export interface SynthMintParams {
  adaNft:         string;
  xauNft:         string;
  xagNft:         string;
  vaultSpendHash: string;   // vault_script_hash in on-chain code
  vaultNftPolicy: string;
}

export function synthMint(params: SynthMintParams) {
  const raw = getRaw("synth_mint.synth_mint.mint");
  const cbor = applyParamsToScript(raw, [
    params.adaNft,
    params.xauNft,
    params.xagNft,
    params.vaultSpendHash,
    params.vaultNftPolicy,
  ]);
  return makeScript(cbor);
}

// ── Oracle Validator (1 parameter: node_nft) ──────────────────
export function oracleValidator(nodeNft: string) {
  const raw = getRaw("oracle_validator.oracle_validator.spend");
  const cbor = applyParamsToScript(raw, [nodeNft]);
  return makeScript(cbor);
}

// ── Derive all scripts in dependency order ────────────────────
export interface AllScriptParams {
  adaNft:              string;
  xauNft:              string;
  xagNft:              string;
  liquidationBonusBps: number;
}

export function deriveAllScripts(params: AllScriptParams) {
  const nft    = vaultNftPolicy();
  const router = vaultRouter({ ...params, vaultNftPolicy: nft.hash });
  const spend  = vaultSpend(router.hash);
  const mint   = synthMint({ ...params, vaultSpendHash: spend.hash, vaultNftPolicy: nft.hash });
  return { nft, router, spend, mint };
}

// ── Script address helper ─────────────────────────────────────
export function scriptAddress(script: PlutusScript, networkId: 0 | 1): string {
  return serializePlutusScript(script, undefined, networkId).address;
}

export function rewardAddress(scriptHash: string, networkId: 0 | 1): string {
  // Reward (staking) address format for withdrawal validator
  const prefix = networkId === 1 ? "e1" : "e0";
  return `${prefix}${scriptHash}`;
}