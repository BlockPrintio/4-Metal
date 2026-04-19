# 4-Metal offchain

TypeScript helpers and `MeshTxBuilder` flows for the 4-Metal protocol: script derivation from the Aiken blueprint, datum/redeemer serialisation aligned with `types.ak`, oracle reference inputs, and vault / synth transactions.

## Layout

```
offchain/
  README.md                 ← this file
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts                Public barrel (re-exports)
    config.ts               Env-driven protocol constants + math helpers
    types.ts                Plutus/Mesh JSON mirrors for datums & redeemers
    scripts/
      blueprint.json        Aiken build output (validator CBOR)
      scripts.ts            Apply parameters, resolve script hashes & addresses
    services/
      oracle.ts             Oracle UTxO fetch, validity range, ref-input wiring
    transactions/
      mintVault.ts          Open vault + mint synth + vault NFT flow
      burnSynth.ts          Repay debt / burn synth (continuation vault)
      withdrawCollateral.ts Add/remove ADA collateral (MCR-aware)
      liquidate.ts          Partial or full liquidation
      closeVault.ts         Close zero-debt vault, burn NFT pair
  tests/
    types.test.ts           Unit tests for serialisers + config math
    support/
      mesh-core-stub.ts     Vitest shim for `@meshsdk/core` (see Scripts)
```

## Module roles

| Area | Responsibility |
|------|----------------|
| **config** | Network, oracle NFT policy IDs, liquidation bonus, precision math mirroring on-chain `math.ak`, synth token name hex, script reference UTxO env vars. |
| **types** | Constructor indices and Mesh `conStr` shapes must match `onchain/lib/types.ak`. Includes `VaultDatum` parse/serialise, redeemers, oracle aggregate parsing, vault NFT name derivation. |
| **scripts** | Loads `blueprint.json`, applies `applyParamsToScript`, exposes `deriveAllScripts` (vault NFT → router → spend → synth mint) plus address helpers. |
| **services/oracle** | Fetches Charli3-style oracle UTxOs by auth NFT policy, builds `OracleRefs`, fixed ref-input order `[ada, asset, settings]` → indices `0, 1, 2`, and tx validity from oracle datums. |
| **transactions/** | Each file builds one user-facing transaction with `MeshTxBuilder`, reference scripts from `SCRIPT_REFS`, and oracle refs where required. |

## Scripts

- `npm test` — run Vitest (`tests/types.test.ts` and any future tests). Vitest aliases `@meshsdk/core` to `tests/support/mesh-core-stub.ts` so serialiser tests do not load optional sodium binaries from the full SDK tree.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run build` — emit JavaScript to `dist/`.

Configure deployed script reference UTxOs and oracle policies via environment variables (see `src/config.ts`).

After rebuilding on-chain validators, refresh `src/scripts/blueprint.json` from the Aiken blueprint (same schema as `plutus.json`):

```bash
cd onchain && aiken build && cp plutus.json ../offchain/src/scripts/blueprint.json
```

If `compiledCode` for any validator is truncated (for example placeholder `...`), `applyParamsToScript` fails with CBOR errors like “not enough bytes”. The file must be a full copy of `plutus.json`.

Deploy reference scripts: set `BLOCKFROST_API_KEY` and `WALLET_MNEMONIC` in `offchain/.env`, then `npm run deploy`. To print hashes only: `npx tsx src/deploy.ts --info`.
