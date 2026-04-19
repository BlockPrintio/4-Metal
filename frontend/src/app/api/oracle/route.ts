import { NextResponse } from "next/server";
// ── Environment Configuration ─────────────────────────────────────────────
const BLOCKFROST_ID = (process.env.BLOCKFROST_PROJECT_ID || "").trim();
const BF            = "https://cardano-preprod.blockfrost.io/api/v0";
const HDR           = { project_id: BLOCKFROST_ID };

const ORACLE_CONF = {
  ada: { addr: (process.env.ADA_ORACLE_ADDRESS || "").trim(), nft: (process.env.ADA_ORACLE_NFT_POLICY || "").trim() },
  xau: { addr: (process.env.XAU_ORACLE_ADDRESS || "").trim(), nft: (process.env.XAU_ORACLE_NFT_POLICY || "").trim() },
  xag: { addr: (process.env.XAG_ORACLE_ADDRESS || "").trim(), nft: (process.env.XAG_ORACLE_NFT_POLICY || "").trim() },
};

// ─── Manual CBOR Decoder (Standalone) ──────────────────────────────────────
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

  if (major === 0) return [n, i]; // integer
  if (major === 2) { // byte string
    const s = b.subarray(i, i + n).toString("hex");
    return [s, i + n];
  }
  if (major === 4) { // array
    const arr: CV[] = [];
    for (let k = 0; k < n; k++) { const [v, ni] = cborDecode(b, i); arr.push(v); i = ni; }
    return [arr, i];
  }
  if (major === 5) { // map
    const pairs: [CV, CV][] = [];
    for (let k = 0; k < n; k++) {
      const [key, ni] = cborDecode(b, i); i = ni;
      const [val, ni2] = cborDecode(b, i); i = ni2;
      pairs.push([key, val]);
    }
    return [pairs, i];
  }
  if (major === 6) { // tag/constr
    const [val, ni] = cborDecode(b, i);
    return [{ tag: n, val }, ni];
  }
  throw new Error(`unsupported major ${major}`);
}

/**
 * Parses Charli3 OracleAgg datum.
 * Structure: Constr 0 [ Constr 2 [ Map { 0: price, 1: createdAt, 2: expiresAt } ] ]
 */
function parseDatum(hex: string): { price: number; createdAt: number; expiresAt: number } {
  try {
    const [root] = cborDecode(Buffer.from(hex, "hex"), 0) as [{ tag: number; val: any[] }, number];
    
    // root.val[0] is Constr 2 [ Map ]
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

    return {
      price:     get(0),
      createdAt: get(1),
      expiresAt: get(2),
    };
  } catch (err) {
    console.error("[Oracle API] Datum parsing failed:", err);
    return { price: 0, createdAt: 0, expiresAt: 0 };
  }
}

async function latestUtxo(label: string, address: string, nftPolicy: string) {
  if (!address || !nftPolicy) {
    console.warn(`[Oracle API] Missing configuration for ${label}`);
    return null;
  }

  try {
    // Fetch with ?order=desc to get recently created UTxOs first
    const res = await fetch(`${BF}/addresses/${address}/utxos?order=desc`, { headers: HDR, cache: "no-store" });
    if (!res.ok) {
      console.error(`[Oracle API] Blockfrost error for ${label}: ${res.status} ${res.statusText}`);
      return null;
    }
    
    const utxos: any[] = await res.json();
    const candidates   = utxos.filter(u =>
      Array.isArray(u.amount) && u.amount.some((a: any) => a.unit.startsWith(nftPolicy)),
    );

    if (!candidates.length) {
      console.warn(`[Oracle API] No candidates found for ${label} (Policy: ${nftPolicy}) at ${address.slice(0, 15)}...`);
      return null;
    }

    let best = candidates[0], bestExpiry = -1;
    for (const c of candidates) {
      if (!c.inline_datum) continue;
      const { expiresAt } = parseDatum(c.inline_datum);
      if (expiresAt > bestExpiry) { 
        bestExpiry = expiresAt; 
        best = c; 
      }
    }
    
    const formattedDate = bestExpiry > 0 ? new Date(bestExpiry).toISOString() : "UNKNOWN";
    console.log(`[Oracle API] Resolved ${label} -> Latest Expiry: ${formattedDate}`);
    return best;
  } catch (err) {
    console.error(`[Oracle API] Critical fetch failure for ${label}:`, err);
    return null;
  }
}

// ─── Route handler ──────────────────────────────────────────────────────────
export async function GET() {
  try {
    console.log("[Oracle API] Pulse Check Started...");
    
    const [adaU, xauU, xagU] = await Promise.all([
      latestUtxo("ADA", ORACLE_CONF.ada.addr, ORACLE_CONF.ada.nft),
      latestUtxo("XAU", ORACLE_CONF.xau.addr, ORACLE_CONF.xau.nft),
      latestUtxo("XAG", ORACLE_CONF.xag.addr, ORACLE_CONF.xag.nft),
    ]);

    const ada = adaU?.inline_datum ? parseDatum(adaU.inline_datum) : null;
    const xau = xauU?.inline_datum ? parseDatum(xauU.inline_datum) : null;
    const xag = xagU?.inline_datum ? parseDatum(xagU.inline_datum) : null;

    const master = xau || xag || ada;
    if (!master) {
      return NextResponse.json({ error: "no_oracle_data_found" }, { status: 404 });
    }

    return NextResponse.json({
      xau:       xau ? xau.price / 1_000_000 : null,
      xag:       xag ? xag.price / 1_000_000 : null,
      ada:       ada ? ada.price / 1_000_000 : null,
      createdAt: master.createdAt,
      expiresAt: master.expiresAt,
      stale:     Date.now() > master.expiresAt,
    });
  } catch (err) {
    console.error("[Oracle API] Fatal error in GET:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
