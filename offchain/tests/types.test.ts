// ============================================================
// types.test.ts  —  Unit tests: serialisers + math
// ============================================================
// Run with:  npm test   (from offchain/)  or  npx vitest run tests/types.test.ts
// No network required — pure data tests.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  serAssetClass,
  serVaultDatum,
  parseVaultDatum,
  serWithdrawRedeemer,
  serLiquidateRedeemer,
  serMintSynthRedeemer,
  serBurnSynthRedeemer,
  serMintVaultNftRedeemer,
  serBurnVaultNftRedeemer,
  parseOracleAggDatum,
  deriveVaultTokenName,
} from "../src/types.js";
import {
  unitPrice,
  collateralRatio,
  maxMintable,
  minCollateral,
  PROTOCOL,
} from "../src/config.js";

// ── AssetClass ────────────────────────────────────────────────

describe("serAssetClass", () => {
  it("XAU → constructor 0", () => {
    const r = serAssetClass("XAU");
    expect(r.constructor).toBe(0);
    expect(r.fields).toHaveLength(0);
  });
  it("XAG → constructor 1", () => {
    const r = serAssetClass("XAG");
    expect(r.constructor).toBe(1);
    expect(r.fields).toHaveLength(0);
  });
});

// ── VaultDatum round-trip ─────────────────────────────────────

describe("VaultDatum round-trip", () => {
  const original = {
    owner:             "6f776e6572",
    collateral_amount: 20_000_000_000n,
    synth_minted:      1_000_000n,
    asset_class:       "XAU" as const,
    vault_nft_name:    "aabbcc",
  };

  it("serialises to constructor 0 with 5 fields", () => {
    const s = serVaultDatum(original);
    expect(s.constructor).toBe(0);
    expect(s.fields).toHaveLength(5);
  });

  it("fields[1] is collateral as integer", () => {
    const s = serVaultDatum(original);
    // Mesh integer() wraps bigint
    expect(BigInt(s.fields[1] as any)).toBe(original.collateral_amount);
  });

  it("fields[3] is AssetClass constructor 0 for XAU", () => {
    const s = serVaultDatum(original);
    expect((s.fields[3] as any).constructor).toBe(0);
  });

  it("parses back correctly", () => {
    // Simulate what deserializeDatum gives us
    const raw = {
      fields: [
        { bytes: original.owner },
        original.collateral_amount,
        original.synth_minted,
        { constructor: 0 },
        { bytes: original.vault_nft_name },
      ],
    } as const;
    const parsed = parseVaultDatum(raw);
    expect(parsed.owner).toBe(original.owner);
    expect(parsed.collateral_amount).toBe(original.collateral_amount);
    expect(parsed.synth_minted).toBe(original.synth_minted);
    expect(parsed.asset_class).toBe("XAU");
    expect(parsed.vault_nft_name).toBe(original.vault_nft_name);
  });
});

// ── VaultRedeemer ─────────────────────────────────────────────

describe("VaultRedeemer", () => {
  const idx = { ada_agg_index: 0, asset_agg_index: 1, settings_index: 2 };

  it("Withdraw → constructor 0", () => {
    const r = serWithdrawRedeemer(idx);
    expect(r.constructor).toBe(0);
    expect(BigInt(r.fields[0] as any)).toBe(0n);
    expect(BigInt(r.fields[1] as any)).toBe(1n);
    expect(BigInt(r.fields[2] as any)).toBe(2n);
  });

  it("Liquidate → constructor 1", () => {
    const r = serLiquidateRedeemer(idx);
    expect(r.constructor).toBe(1);
    expect(BigInt(r.fields[2] as any)).toBe(2n);
  });
});

// ── MintRedeemer ──────────────────────────────────────────────

describe("MintRedeemer", () => {
  const idx = { ada_agg_index: 0, asset_agg_index: 1, settings_index: 2 };

  it("MintSynth → constructor 0", () => {
    const r = serMintSynthRedeemer(idx);
    expect(r.constructor).toBe(0);
  });

  it("BurnSynth → constructor 1, no fields", () => {
    const r = serBurnSynthRedeemer();
    expect(r.constructor).toBe(1);
    expect(r.fields).toHaveLength(0);
  });
});

// ── VaultNftRedeemer ──────────────────────────────────────────

describe("VaultNftRedeemer", () => {
  it("MintVaultNft → constructor 0 with txHash and index", () => {
    const r = serMintVaultNftRedeemer("aabbcc", 0);
    expect(r.constructor).toBe(0);
    expect(r.fields).toHaveLength(2);
    expect((r.fields[0] as any).bytes).toBe("aabbcc");
  });

  it("BurnVaultNft → constructor 1, no fields", () => {
    const r = serBurnVaultNftRedeemer();
    expect(r.constructor).toBe(1);
    expect(r.fields).toHaveLength(0);
  });
});

// ── Oracle datum parsing ───────────────────────────────────────

describe("parseOracleAggDatum", () => {
  it("extracts price, created_at, expires_at", () => {
    const raw = {
      fields: [[
        { k: 0, v: 258_000 },
        { k: 1, v: 900_000 },
        { k: 2, v: 1_600_000 },
      ]],
    };
    const r = parseOracleAggDatum(raw);
    expect(r.price).toBe(258_000n);
    expect(r.created_at).toBe(900_000n);
    expect(r.expires_at).toBe(1_600_000n);
  });

  it("accepts Mesh nested constructor + map_* cells (string keys/values)", () => {
    const raw = {
      constructor: 0,
      fields: [
        {
          constructor: 2,
          fields: [
            {
              map_0: { mapKey: "0", mapValue: "79676455" },
              map_1: { mapKey: "1", mapValue: "1776478555000" },
              map_2: { mapKey: "2", mapValue: "1776479155000" },
            },
          ],
        },
      ],
    };
    const r = parseOracleAggDatum(raw);
    expect(r.price).toBe(79_676_455n);
    expect(r.created_at).toBe(1_776_478_555_000n);
    expect(r.expires_at).toBe(1_776_479_155_000n);
  });
});

// ── Vault token name ──────────────────────────────────────────

describe("deriveVaultTokenName", () => {
  it("is 62 hex chars (31 bytes)", () => {
    const txHash = "a".repeat(64);
    const name = deriveVaultTokenName(txHash, 0);
    expect(name).toHaveLength(62);
  });

  it("last byte encodes output index", () => {
    const txHash = "a".repeat(64);
    expect(deriveVaultTokenName(txHash, 0)).toMatch(/00$/);
    expect(deriveVaultTokenName(txHash, 1)).toMatch(/01$/);
    expect(deriveVaultTokenName(txHash, 255)).toMatch(/ff$/);
  });
});

// ── Math helpers (mirrors math.ak) ───────────────────────────

describe("Math — unitPrice", () => {
  const P = PROTOCOL.PRECISION;

  it("XAG: $79.676455 / $0.258 ≈ 308823 ADA/XAG", () => {
    const result = unitPrice(79_676_455n, 258_000n);
    expect(result).toBeGreaterThanOrEqual(308_823_000n);
    expect(result).toBeLessThanOrEqual(308_824_000n);
  });

  it("XAU: $3285 / $0.258 ≈ 12732 ADA/XAU", () => {
    const result = unitPrice(3_285_000_000n, 258_000n);
    expect(result).toBeGreaterThanOrEqual(12_732_558_000n);
  });
});

describe("Math — collateralRatio", () => {
  const P = PROTOCOL.PRECISION;

  it("150% when collateral = 1.5x debt", () => {
    const ratio = collateralRatio(150n * P, 1n * P, 100n * P);
    expect(ratio).toBe(150n);
  });

  it("zero synths → sentinel 999999", () => {
    expect(collateralRatio(10_000_000n, 0n, 100_000_000n)).toBe(999_999n);
  });
});

describe("Math — maxMintable", () => {
  const P = PROTOCOL.PRECISION;

  it("150 ADA collateral, 100 ADA/unit, 150% ratio → max 1 unit", () => {
    const max = maxMintable(150n * P, 100n * P, 150n);
    expect(max).toBe(1n * P);
  });
});

describe("Math — minCollateral", () => {
  const P = PROTOCOL.PRECISION;

  it("1 unit at 100 ADA/unit, 150% → 150 ADA", () => {
    const min = minCollateral(1n * P, 100n * P, 150n);
    expect(min).toBe(150n * P);
  });
});

// ── Collateral ratio enforcement guards ───────────────────────

describe("Collateral ratio — mint scenario", () => {
  // mirrors test_synth_mint_success from synth_mint.ak
  // ADA price: $0.258, XAU price: $3285, precision: 1_000_000
  // unit_price = 3_285_000_000 * 1_000_000 / 258_000 = 12_732_558_139

  it("20_000 ADA collateral, 1 aXAU minted → ratio > 150%", () => {
    const adaRaw   = 258_000n;
    const xauRaw   = 3_285_000_000n;
    const price    = unitPrice(xauRaw, adaRaw);
    const ratio    = collateralRatio(20_000_000_000n, 1_000_000n, price);
    expect(ratio).toBeGreaterThanOrEqual(150n);
  });

  // mirrors test_mint_low_ratio_fails
  it("10_000 ADA collateral, 10 aXAU minted → ratio < 150% (fails)", () => {
    const price = unitPrice(3_285_000_000n, 258_000n);
    const ratio = collateralRatio(10_000_000_000n, 10_000_000n, price);
    expect(ratio).toBeLessThan(150n);
  });
});