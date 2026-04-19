// ============================================================
// oracle.ts  —  Oracle reference input helpers
// ============================================================
// Fetches live Charli3 oracle UTxOs, validates liveness,
// and computes the reference_input indices the on-chain
// validator expects (ada_agg_index, asset_agg_index, settings_index).
//
// The on-chain oracle.ak uses list.at(tx.reference_inputs, index)
// so the order we add them to the tx determines the index.
// We always add them in this order: [ada, asset, settings]
//   → ada_agg_index:   0
//   → asset_agg_index: 1
//   → settings_index:  2
// ============================================================

import { IFetcher, UTxO } from "@meshsdk/core";
import { parseOracleAggDatum, OracleAgg } from "../types.js";
import { ORACLE_CONFIG, PROTOCOL } from "../config.js";

// (Time-to-slot conversion removed as on-chain liveness is now time-agnostic)

export interface OracleRefs {
  ada:      UTxO;
  asset:    UTxO;
}

// Fixed oracle reference input order — must match how you call addOracleRefs.
export const ORACLE_INDICES = {
  ada_agg_index:   0,
  asset_agg_index: 1,
} as const;

// ── Fetch oracle UTxOs ────────────────────────────────────────
// Finds the UTxO carrying the oracle authentication NFT.
// Throws if not found or datum is missing.

async function fetchOracleUtxo(
  fetcher: IFetcher,
  nftPolicyId: string,
  nftAssetName: string,
  address: string,
  label: string,
): Promise<UTxO> {
  const targetUnit = nftPolicyId + nftAssetName;
  const utxos = await fetcher.fetchAddressUTxOs(address).catch(() => [] as UTxO[]);

  // Collect potential candidates matching the EXACT unit
  const candidates: UTxO[] = [];
  if (utxos.length === 0) {
    // If address lookup fails or is empty, try direct asset lookup
    const assetUtxos = await fetcher.fetchUTxOs?.(targetUnit).catch(() => []) ?? [];
    candidates.push(...assetUtxos.filter(u => u.output.plutusData));
  } else {
    candidates.push(...utxos.filter(u =>
      u.output.plutusData &&
      u.output.amount.some(a => a.unit === targetUnit)
    ));
  }

  if (candidates.length === 0) {
    throw new Error(`Oracle UTxO not found for ${label} (unit: ${targetUnit})`);
  }

  // Find the UTxO with the latest expires_at
  let best: UTxO | undefined;
  let bestExpiry = -1n;

  for (const utxo of candidates) {
    if (!utxo.output.plutusData) continue;
    try {
      const datum = parseOracleAggDatum(utxo.output.plutusData);
      if (datum.expires_at > bestExpiry) {
        bestExpiry = datum.expires_at;
        best = utxo;
      }
    } catch (err) {
      console.warn(`[Oracle Service] Malformed datum for ${label} UTxO:`, err);
    }
  }

  if (!best) throw new Error(`Valid datum not resolved for ${label}`);
  return best;
}

export async function fetchOracleRefs(
  fetcher: IFetcher,
  assetClass: "XAU" | "XAG",
): Promise<OracleRefs> {
  const assetNft   = assetClass === "XAU" ? ORACLE_CONFIG.XAU_NFT_POLICY  : ORACLE_CONFIG.XAG_NFT_POLICY;
  const assetName  = assetClass === "XAU" ? ORACLE_CONFIG.XAU_ORACLE_NAME : ORACLE_CONFIG.XAG_ORACLE_NAME;
  const assetAddr  = assetClass === "XAU" ? ORACLE_CONFIG.XAU_ORACLE_ADDRESS : ORACLE_CONFIG.XAG_ORACLE_ADDRESS;

  const [ada, asset] = await Promise.all([
    fetchOracleUtxo(fetcher, ORACLE_CONFIG.ADA_NFT_POLICY,      ORACLE_CONFIG.ADA_ORACLE_NAME,      ORACLE_CONFIG.ADA_ORACLE_ADDRESS,      "ADA"),
    fetchOracleUtxo(fetcher, assetNft,                         assetName,                         assetAddr,                             assetClass),
  ]);
  return { ada, asset };
}

// ── Validity range from oracle datums ────────────────────────
// On-chain validate_liveness requires:
//   created_at <= lower_bound
//   expires_at + 900_000 >= upper_bound (15 min grace period)
// We set the tx window to [max(created_at), min(expires_at)] to be safe.

export function oracleValidityRange(refs: OracleRefs): {
  invalidBefore:    number;
  invalidHereafter: number;
} {
  const ada   = parseOracleAggDatum(refs.ada.output.plutusData!);
  const asset = parseOracleAggDatum(refs.asset.output.plutusData!);

  // Validity range must be within [created_at, expires_at]
  // We use millisecond POSIX time as Mesh expects.
  const invalidBefore    = Number(ada.created_at > asset.created_at ? ada.created_at : asset.created_at);
  const invalidHereafter = Number(ada.expires_at < asset.expires_at ? ada.expires_at : asset.expires_at);

  return { invalidBefore, invalidHereafter };
}

// ── Add oracle reference inputs to tx builder ─────────────────
// Always adds in order: [ada, asset, settings] → indices [0, 1, 2]

export function addOracleRefs(txBuilder: any, refs: OracleRefs) {
  return txBuilder
    .readOnlyTxInReference(refs.ada.input.txHash,      refs.ada.input.outputIndex)
    .readOnlyTxInReference(refs.asset.input.txHash,    refs.asset.input.outputIndex);
}
