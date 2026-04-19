// ============================================================
// deploy.ts  —  Publish 4-Metal reference scripts on-chain
// ============================================================
// Usage:
//   npm run deploy:info   (or npx tsx src/deploy.ts --info)  print hashes only, no tx
//   npm run deploy        publish all 4 scripts
//
// Output UTxO order (fixed — offchain reads by index):
//   0 → vault_nft_policy
//   1 → vault_router
//   2 → vault_spend
//   3 → synth_mint
// ============================================================

import "dotenv/config";

import { deriveAllScripts, scriptAddress } from "./scripts/scripts.js";
import { ORACLE_CONFIG, PROTOCOL } from "./config.js";

const INFO_ONLY = process.argv.includes("--info");

// Min UTxO per reference-script output (Conway era, measured on preprod).
// Formula: base_utxo + ceil(script_bytes / 8) * bytes_per_word_lovelace
const MIN_LOVELACE = {
  vaultNft:    4_000_000n,   // ~3.9 ADA
  vaultRouter: 14_000_000n,  // ~13.4 ADA — largest script
  vaultSpend:  3_000_000n,   // ~2.5 ADA
  synthMint:   12_000_000n,  // ~11.4 ADA
} as const;

const TOTAL = Object.values(MIN_LOVELACE).reduce((a, b) => a + b, 0n); // 33 ADA

async function main() {
  // ── 1. Derive all script hashes ──────────────────────────────
  const scripts = deriveAllScripts({
    adaNft:              ORACLE_CONFIG.ADA_NFT_POLICY,
    xauNft:              ORACLE_CONFIG.XAU_NFT_POLICY,
    xagNft:              ORACLE_CONFIG.XAG_NFT_POLICY,
    liquidationBonusBps: PROTOCOL.LIQUIDATION_BONUS_BPS,
  });

  const vaultAddr = scriptAddress(scripts.spend.plutusScript, PROTOCOL.NETWORK_ID);

  console.log("\n=== 4-Metal Script Hashes ===");
  console.log(`  vault_nft_policy  : ${scripts.nft.hash}`);
  console.log(`  vault_router      : ${scripts.router.hash}`);
  console.log(`  vault_spend       : ${scripts.spend.hash}`);
  console.log(`  synth_mint        : ${scripts.mint.hash}`);
  console.log(`  vault_spend addr  : ${vaultAddr}`);

  if (INFO_ONLY) {
    console.log("\n(--info only — no transaction submitted)");
    // Mesh pulls libsodium via the module graph; on some Node setups the
    // async init surfaces as an unhandled rejection on shutdown after exit.
    process.exit(0);
  }

  const { MeshTxBuilder, BlockfrostProvider, MeshWallet } = await import("@meshsdk/core");

  // ── 2. Set up provider + wallet ──────────────────────────────
  const apiKey = process.env.BLOCKFROST_API_KEY;
  if (!apiKey) throw new Error("BLOCKFROST_API_KEY not set in .env");

  const mnemonic = process.env.WALLET_MNEMONIC?.split(" ");
  if (!mnemonic?.length) throw new Error("WALLET_MNEMONIC not set in .env");

  const provider = new BlockfrostProvider(apiKey);
  const wallet   = new MeshWallet({
    networkId:      PROTOCOL.NETWORK_ID,
    fetcher:        provider,
    submitter:      provider,
    key: { type: "mnemonic", words: mnemonic },
  });

  const changeAddress = await wallet.getChangeAddress();
  const walletUtxos   = await wallet.getUtxos();
  const collaterals   = await wallet.getCollateral();

  if (!collaterals?.length) throw new Error("No collateral UTxO set in wallet");
  const collateral = collaterals[0]!;

  console.log(`\nDeploying from: ${changeAddress}`);

  // Accumulate wallet UTxOs (skip collateral) until we have enough ADA
  const NEEDED = TOTAL + 2_000_000n;
  let accumulated = 0n;
  const funders = [];
  for (const u of walletUtxos) {
    if (u.input.txHash === collateral.input.txHash) continue;
    funders.push(u);
    accumulated += BigInt(u.output.amount.find(a => a.unit === "lovelace")?.quantity ?? 0);
    if (accumulated >= NEEDED) break;
  }

  if (accumulated < NEEDED) {
    throw new Error(
      `Insufficient ADA. Need ≥${Number(NEEDED) / 1e6} ADA, have ${Number(accumulated) / 1e6} ADA.\n` +
      `Top up at https://docs.cardano.org/cardano-testnets/tools/faucet/`,
    );
  }

  console.log(`Inputs: ${funders.length} UTxO(s), ${Number(accumulated) / 1e6} ADA`);
  console.log("Building transaction...");

  // ── 3. Build tx with 4 reference-script outputs ──────────────
  const txBuilder = new MeshTxBuilder({ fetcher: provider, submitter: provider });

  for (const u of funders) {
    txBuilder.txIn(
      u.input.txHash,
      u.input.outputIndex,
      u.output.amount,
      changeAddress,
    );
  }

  txBuilder
    // Output 0: vault_nft_policy
    .txOut(changeAddress, [{ unit: "lovelace", quantity: MIN_LOVELACE.vaultNft.toString() }])
    .txOutReferenceScript(scripts.nft.cbor, "V3")

    // Output 1: vault_router
    .txOut(changeAddress, [{ unit: "lovelace", quantity: MIN_LOVELACE.vaultRouter.toString() }])
    .txOutReferenceScript(scripts.router.cbor, "V3")

    // Output 2: vault_spend
    .txOut(changeAddress, [{ unit: "lovelace", quantity: MIN_LOVELACE.vaultSpend.toString() }])
    .txOutReferenceScript(scripts.spend.cbor, "V3")

    // Output 3: synth_mint
    .txOut(changeAddress, [{ unit: "lovelace", quantity: MIN_LOVELACE.synthMint.toString() }])
    .txOutReferenceScript(scripts.mint.cbor, "V3")

    .txInCollateral(
      collateral.input.txHash,
      collateral.input.outputIndex,
      collateral.output.amount,
      collateral.output.address,
    )
    .changeAddress(changeAddress)
    .setNetwork(PROTOCOL.NETWORK === "mainnet" ? "mainnet" : "preprod");

  const txHex    = await txBuilder.complete();
  const signedTx = await wallet.signTx(txHex);
  const txHash   = await wallet.submitTx(signedTx);

  console.log(`\nTx submitted: ${txHash}`);
  console.log("Waiting for confirmation (~20-60s on preprod)...\n");

  // ── 4. Write .env values ─────────────────────────────────────
  await writeEnv({
    VAULT_NFT_POLICY_ID:      scripts.nft.hash,
    VAULT_ROUTER_SCRIPT_HASH: scripts.router.hash,
    VAULT_SPEND_SCRIPT_HASH:  scripts.spend.hash,
    SYNTH_MINT_POLICY_ID:     scripts.mint.hash,
    VAULT_SPEND_ADDRESS:      vaultAddr,
    REF_VAULT_NFT_TX:         txHash,
    REF_VAULT_NFT_IDX:        "0",
    REF_VAULT_ROUTER_TX:      txHash,
    REF_VAULT_ROUTER_IDX:     "1",
    REF_VAULT_SPEND_TX:       txHash,
    REF_VAULT_SPEND_IDX:      "2",
    REF_SYNTH_MINT_TX:        txHash,
    REF_SYNTH_MINT_IDX:       "3",
  });

  console.log("=== Copy these into your .env ===");
  console.log(`VAULT_NFT_POLICY_ID=${scripts.nft.hash}`);
  console.log(`VAULT_ROUTER_SCRIPT_HASH=${scripts.router.hash}`);
  console.log(`VAULT_SPEND_SCRIPT_HASH=${scripts.spend.hash}`);
  console.log(`SYNTH_MINT_POLICY_ID=${scripts.mint.hash}`);
  console.log(`VAULT_SPEND_ADDRESS=${vaultAddr}`);
  console.log(`REF_VAULT_NFT_TX=${txHash}`);
  console.log(`REF_VAULT_ROUTER_TX=${txHash}`);
  console.log(`REF_VAULT_SPEND_TX=${txHash}`);
  console.log(`REF_SYNTH_MINT_TX=${txHash}`);
}

async function writeEnv(updates: Record<string, string>) {
  try {
    const fs   = await import("node:fs");
    const path = await import("node:path");
    const envPath = path.join(process.cwd(), ".env");

    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    for (const [key, val] of Object.entries(updates)) {
      const re = new RegExp(`^${key}=.*`, "m");
      content = re.test(content)
        ? content.replace(re, `${key}=${val}`)
        : content + `\n${key}=${val}`;
    }
    fs.writeFileSync(envPath, content.trimStart(), "utf8");
    console.log(`\n✅ .env updated`);
  } catch (e) {
    console.warn(`⚠️  Could not update .env: ${e instanceof Error ? e.message : e}`);
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});