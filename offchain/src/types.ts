// ============================================================
// types.ts  —  On-chain type mirrors + JSON datum serialisers
// ============================================================
// Every conStr index here must match the Aiken constructor order
// in types.ak exactly.  The JSON format is what MeshTxBuilder
// expects when you pass "JSON" as the second arg to datum/redeemer
// methods — it maps directly to PlutusData constructors.
//
// conStr0([...]) → { constructor: 0, fields: [...] }
// conStr1([...]) → { constructor: 1, fields: [...] }
// ============================================================

import {
  conStr0,
  conStr1,
  byteString,
  integer,
} from "@meshsdk/core";
import { cborDecode } from "./cbor.js";

// ── AssetClass ───────────────────────────────────────────────
// XAU = constructor 0 (no fields)
// XAG = constructor 1 (no fields)

export type AssetClass = "XAU" | "XAG";

export function serAssetClass(ac: AssetClass) {
  return ac === "XAU" ? conStr0([]) : conStr1([]);
}

// ── VaultDatum ───────────────────────────────────────────────
// constructor 0:
//   fields[0] owner              ByteArray (VerificationKeyHash)
//   fields[1] collateral_amount  Int       (lovelace)
//   fields[2] synth_minted       Int       (precision-scaled units)
//   fields[3] asset_class        AssetClass
//   fields[4] vault_nft_name     ByteArray

export interface VaultDatum {
  owner:             string;  // pkh hex
  collateral_amount: bigint;
  synth_minted:      bigint;
  asset_class:       AssetClass;
  vault_nft_name:    string;  // token name hex
}

export function serVaultDatum(d: VaultDatum) {
  return conStr0([
    byteString(d.owner),
    integer(d.collateral_amount),
    integer(d.synth_minted),
    serAssetClass(d.asset_class),
    byteString(d.vault_nft_name),
  ]);
}

export function parseVaultDatum(raw: any): VaultDatum {
  return {
    owner:             raw.fields[0].bytes,
    collateral_amount: BigInt(raw.fields[1]),
    synth_minted:      BigInt(raw.fields[2]),
    asset_class:       raw.fields[3].constructor === 0 ? "XAU" : "XAG",
    vault_nft_name:    raw.fields[4].bytes,
  };
}

// ── VaultRedeemer ────────────────────────────────────────────
// Withdraw  = constructor 0 { ada_agg_index, asset_agg_index }
// Liquidate = constructor 1 { ada_agg_index, asset_agg_index }

export interface OracleIndices {
  ada_agg_index:    number;
  asset_agg_index:  number;
}

export function serWithdrawRedeemer(idx: OracleIndices) {
  return conStr0([
    integer(idx.ada_agg_index),
    integer(idx.asset_agg_index),
  ]);
}

export function serLiquidateRedeemer(idx: OracleIndices) {
  return conStr1([
    integer(idx.ada_agg_index),
    integer(idx.asset_agg_index),
  ]);
}

// ── MintRedeemer ─────────────────────────────────────────────
// MintSynth = constructor 0 { ada_agg_index, asset_agg_index }
// BurnSynth = constructor 1 (no fields)

export function serMintSynthRedeemer(idx: OracleIndices) {
  return conStr0([
    integer(idx.ada_agg_index),
    integer(idx.asset_agg_index),
  ]);
}

export function serBurnSynthRedeemer() {
  return conStr1([]);
}

// ── VaultNftRedeemer ─────────────────────────────────────────
// MintVaultNft = constructor 0 { seed_tx_hash: ByteArray, seed_output_index: Int }
// BurnVaultNft = constructor 1 (no fields)

export function serMintVaultNftRedeemer(seedTxHash: string, seedOutputIndex: number) {
  return conStr0([
    byteString(seedTxHash),
    integer(seedOutputIndex),
  ]);
}

export function serBurnVaultNftRedeemer() {
  return conStr1([]);
}

// ── Oracle datum parsing ─────────────────────────────────────
// On-chain: OracleDatum → OracleAgg { price_map: Pairs<Int, Int> }
// Charli3 / Mesh JSON often nests constructor 0 → constructor 2 → map_* cells.
// price_map keys:
//   0 → price (6 dp), 1 → created_at (POSIX ms), 2 → expires_at (POSIX ms)

export interface OracleAgg {
  price:      bigint;
  created_at: bigint;
  expires_at: bigint;
}

/** Mesh / explorer JSON: `{ map_0: { mapKey, mapValue }, ... }` */
function tryMeshMapCells(obj: any): Map<number, bigint> | null {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const out = new Map<number, bigint>();
  for (const key of Object.keys(obj)) {
    const m = /^map_(\d+)$/.exec(key);
    if (!m) continue;
    const cell = obj[key];
    if (!cell || typeof cell !== "object") continue;
    const k = Number(cell.mapKey ?? m[1]);
    const rawV = cell.mapValue ?? cell.v ?? cell[1];
    if (rawV === undefined || rawV === null || Number.isNaN(k)) continue;
    out.set(k, BigInt(String(rawV)));
  }
  return out.size > 0 ? out : null;
}

function mapFromPairList(arr: any[]): Map<number, bigint> {
  const out = new Map<number, bigint>();
  for (const p of arr) {
    const k = Number(p?.k ?? p?.[0]);
    if (Number.isNaN(k)) continue;
    const rawV = p?.v ?? p?.[1];
    out.set(k, rawV === undefined || rawV === null ? 0n : BigInt(String(rawV)));
  }
  return out;
}

function walkForPriceMap(node: any): Map<number, bigint> | null {
  if (!node || typeof node !== "object") return null;

  // 1. Try Mesh map_* format or plain object map
  const asMesh = tryMeshMapCells(node);
  if (asMesh && asMesh.has(0) && asMesh.has(1) && asMesh.has(2)) return asMesh;

  // 2. Try array of pairs [[k,v], [k,v]] or list of {k,v}
  if (Array.isArray(node)) {
    const m = mapFromPairList(node);
    if (m.has(0) && m.has(1) && m.has(2)) return m;
    // Recurse into array children
    for (const child of node) {
      const w = walkForPriceMap(child);
      if (w) return w;
    }
  }

  // 3. Try Mesh / JSON fields
  if (Array.isArray(node.fields)) {
    for (const child of node.fields) {
      const w = walkForPriceMap(child);
      if (w) return w;
    }
  }

  // 4. Try decoded CBOR { tag, val }
  if (node.val !== undefined) {
    return walkForPriceMap(node.val);
  }

  return null;
}

/**
 * Parses Charli3 aggregate datum. Supports:
 * (1) Raw hex string (uses robust manual CBOR decoder)
 * (2) Mesh JSON object result from deserializeDatum
 */
export function parseOracleAggDatum(raw: any): OracleAgg {
  let target = raw;

  // If it's a hex string, decode it first
  if (typeof raw === "string" && /^[0-9a-fA-F]+$/.test(raw)) {
    try {
      const [decoded] = cborDecode(Buffer.from(raw, "hex"), 0);
      target = decoded;
    } catch (err) {
      console.warn("[Oracle Types] Manual CBOR decode failed, trying as JSON:", err);
    }
  }

  const m = walkForPriceMap(target);
  if (m && m.has(0) && m.has(1) && m.has(2)) {
    return {
      price:      m.get(0)!,
      created_at: m.get(1)!,
      expires_at: m.get(2)!,
    };
  }

  throw new Error(
    `parseOracleAggDatum: unrecognized oracle datum (expected price map with keys 0,1,2). Data: ${JSON.stringify(raw).slice(0, 100)}...`,
  );
}

// ── Vault NFT token name derivation ──────────────────────────
// Mirrors vault_nft.ak:  slice(tx_id, 0, 30) ++ integer_to_byte_array(True, 1, index)
// Result is a 31-byte hex string (62 hex chars).

export function deriveVaultTokenName(txHash: string, outputIndex: number): string {
  const truncatedTxId = txHash.slice(0, 60); // 30 bytes = 60 hex chars
  const indexByte = outputIndex.toString(16).padStart(2, "0");
  return truncatedTxId + indexByte;
}