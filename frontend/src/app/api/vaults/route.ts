import { NextResponse } from "next/server";

const BF  = "https://cardano-preprod.blockfrost.io/api/v0";
const HDR = { project_id: (process.env.BLOCKFROST_PROJECT_ID || "").trim() };
const BONUS_BPS = 1_000; // 10%

// ─── Generic Plutus CBOR decoder ───────────────────────────────────────────
type CV = number | string | CV[] | [CV, CV][] | { tag: number; val: CV };

function cborDecode(b: Buffer, i: number): [CV, number] {
  const byte = b[i], major = byte >> 5, add = byte & 0x1f;
  i++;

  if (add === 31) { // Indefinite length
    if (major === 2) { // Byte string chunks
      let chunks = Buffer.alloc(0);
      while (b[i] !== 0xff) {
        const [v, ni] = cborDecode(b, i);
        chunks = Buffer.concat([chunks, Buffer.from(v as string, "hex")]);
        i = ni;
      }
      return [chunks.toString("hex"), i + 1];
    }
    if (major === 4) { // Array
      const arr: CV[] = [];
      while (b[i] !== 0xff) {
        const [v, ni] = cborDecode(b, i);
        arr.push(v);
        i = ni;
      }
      return [arr, i + 1];
    }
    if (major === 5) { // Map
      const pairs: [CV, CV][] = [];
      while (b[i] !== 0xff) {
        const [key, ni] = cborDecode(b, i); i = ni;
        const [val, ni2] = cborDecode(b, i); i = ni2;
        pairs.push([key, val]);
      }
      return [pairs, i + 1];
    }
    throw new Error(`unsupported indefinite major ${major}`);
  }

  let n: number;
  if      (add < 24)   n = add;
  else if (add === 24) n = b[i++];
  else if (add === 25) { n = b.readUInt16BE(i);          i += 2; }
  else if (add === 26) { n = b.readUInt32BE(i);          i += 4; }
  else if (add === 27) { n = Number(b.readBigUInt64BE(i)); i += 8; }
  else throw new Error(`unsupported cbor add ${add}`);

  if (major === 0) return [n, i];
  if (major === 2) { const s = b.subarray(i, i + n).toString("hex"); return [s, i + n]; }
  if (major === 4) {
    const arr: CV[] = [];
    for (let k = 0; k < n; k++) { const [v, ni] = cborDecode(b, i); arr.push(v); i = ni; }
    return [arr, i];
  }
  if (major === 5) {
    const pairs: [CV, CV][] = [];
    for (let k = 0; k < n; k++) {
      const [key, ni] = cborDecode(b, i); i = ni;
      const [val, ni2] = cborDecode(b, i); i = ni2;
      pairs.push([key, val]);
    }
    return [pairs, i];
  }
  if (major === 6) { const [val, ni] = cborDecode(b, i); return [{ tag: n, val }, ni]; }
  throw new Error(`unsupported major ${major}`);
}

// ─── Datum parsers ──────────────────────────────────────────────────────────

function parseVaultDatum(hex: string) {
  const [root] = cborDecode(Buffer.from(hex, "hex"), 0) as [{ tag: number; val: any[] }, number];
  const [owner, collateral, synthMinted, assetConstr, nftName] = root.val;
  return {
    owner:       owner       as string,
    collateral:  collateral  as number,
    synthMinted: synthMinted as number,
    assetClass:  (assetConstr as { tag: number }).tag === 121 ? "XAU" : "XAG" as "XAU" | "XAG",
    nftName:     nftName     as string,
  };
}

function parseOracleDatum(hex: string) {
  try {
    const [root] = cborDecode(Buffer.from(hex, "hex"), 0) as [{ tag: number; val: any[] }, number];
    const inner = root.val[0] as { tag: number; val: any[] };
    const map   = inner.val[0] as [CV, CV][];

    const get = (key: number) => {
      const entry = map.find(([k]) => {
        if (typeof k === "number") return k === key;
        if (typeof k === "string") return parseInt(k, 10) === key;
        return false;
      });
      return Number(entry?.[1] ?? 0);
    };

    return { price: get(0), createdAt: get(1), expiresAt: get(2) };
  } catch (err) {
    console.error("[Vaults API] Oracle datum parsing failed:", err);
    return { price: 0, createdAt: 0, expiresAt: 0 };
  }
}

// ─── Blockfrost helpers ─────────────────────────────────────────────────────

async function latestUtxo(label: string, address: string, nftPolicy: string) {
  if (!address || !nftPolicy) return null;
  const res = await fetch(`${BF}/addresses/${address}/utxos?order=desc`, { headers: HDR, cache: "no-store" });
  if (!res.ok) {
    console.error(`[Vaults API] Blockfrost error for ${label}: ${res.status}`);
    return null;
  }
  const utxos: any[] = await res.json();
  const candidates = utxos.filter(u =>
    Array.isArray(u.amount) && u.amount.some((a: any) => a.unit.startsWith(nftPolicy)),
  );
  if (!candidates.length) return null;
  
  let best = candidates[0], bestExpiry = -1;
  for (const c of candidates) {
    if (!c.inline_datum) continue;
    try { 
      const { expiresAt } = parseOracleDatum(c.inline_datum); 
      if (expiresAt > bestExpiry) { bestExpiry = expiresAt; best = c; } 
    } catch {}
  }
  return best;
}

// ─── Route ─────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // Fetch oracle prices and all vault UTxOs in parallel
    const [adaU, xauU, xagU, vaultRes] = await Promise.all([
      latestUtxo("ADA", process.env.ADA_ORACLE_ADDRESS!, process.env.ADA_ORACLE_NFT_POLICY!),
      latestUtxo("XAU", process.env.XAU_ORACLE_ADDRESS!, process.env.XAU_ORACLE_NFT_POLICY!),
      latestUtxo("XAG", process.env.XAG_ORACLE_ADDRESS!, process.env.XAG_ORACLE_NFT_POLICY!),
      fetch(`${BF}/addresses/${process.env.VAULT_SPEND_ADDRESS}/utxos?count=100`, { headers: HDR, cache: "no-store" }),
    ]);

    if (!adaU?.inline_datum || !xauU?.inline_datum || !xagU?.inline_datum) {
      return NextResponse.json({ error: "oracle_unavailable" }, { status: 503 });
    }

    const adaPrice = parseOracleDatum(adaU.inline_datum).price;
    const xauPrice = parseOracleDatum(xauU.inline_datum).price;
    const xagPrice = parseOracleDatum(xagU.inline_datum).price;

    const vaultUtxos: any[] = vaultRes.ok ? await vaultRes.json() : [];

    const vaults = vaultUtxos
      .filter(u => u.inline_datum)
      .map(u => {
        try {
          const d = parseVaultDatum(u.inline_datum);
          if (d.synthMinted === 0) return null; // no debt → not liquidatable

          const assetPrice = d.assetClass === "XAU" ? xauPrice : xagPrice;

          // ratio = (collateral × adaPrice × 100) / (synthMinted × assetPrice)
          const ratio = Math.floor(
            Number((BigInt(d.collateral) * BigInt(adaPrice) * 100n) /
                   (BigInt(d.synthMinted) * BigInt(assetPrice)))
          );

          // claim = synthMinted × assetPrice × (10000 + bonusBps) / (adaPrice × 10000)
          const claimLovelace = Number(
            (BigInt(d.synthMinted) * BigInt(assetPrice) * BigInt(10_000 + BONUS_BPS)) /
            (BigInt(adaPrice) * 10_000n)
          );

          return {
            txHash:      u.tx_hash as string,
            outputIndex: u.tx_index as number,
            owner:       d.owner,
            collateral:  d.collateral,
            synthMinted: d.synthMinted,
            assetClass:  d.assetClass,
            nftName:     d.nftName,
            ratio,
            underwater:  ratio < 150,
            claimAda:    Math.min(claimLovelace, d.collateral) / 1_000_000,
          };
        } catch { return null; }
      })
      .filter(Boolean);

    return NextResponse.json({ vaults, adaPrice, xauPrice, xagPrice });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
