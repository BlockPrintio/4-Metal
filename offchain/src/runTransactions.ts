// ============================================================
// runTransactions.ts — manual harness for all tx builders
// ============================================================
// Uncomment exactly ONE block inside main(), fill the TODO
// constants, then run from offchain/:
//
//   npm run tx:try
//   # or: npx tsx src/runTransactions.ts
//
// Each builder returns an unsigned tx hex from MeshTxBuilder.complete().
// signSubmit() signs with WALLET_MNEMONIC and submits via Blockfrost.
// ============================================================

import "dotenv/config";

import type { UTxO } from "@meshsdk/core";

import { PROTOCOL, ORACLE_CONFIG } from "./config.js";
import { deriveAllScripts, scriptAddress } from "./scripts/scripts.js";
import { fetchOracleRefs } from "./services/oracle.js";
import { mintVault } from "./transactions/mintVault.js";
import { burnSynth } from "./transactions/burnSynth.js";
import { closeVault } from "./transactions/closeVault.js";
import { liquidate } from "./transactions/liquidate.js";
import { withdrawCollateral } from "./transactions/withdrawCollateral.js";

/** Oracle feed for fetchOracleRefs — must match vault asset when minting. */
const ASSET_CLASS: "XAU" | "XAG" = "XAU";

/** Replace and use with findVaultUtxo() when testing vault/receipt flows. */
const VAULT_TX_HASH = "0000000000000000000000000000000000000000000000000000000000000000";
const VAULT_OUTPUT_INDEX = 0;

/** For closeVault: wallet UTxO that holds the receipt NFT (same name as vault NFT). */
const RECEIPT_TX_HASH = "0000000000000000000000000000000000000000000000000000000000000000";
const RECEIPT_OUTPUT_INDEX = 0;

async function findVaultUtxo(
  fetcher: { fetchAddressUTxOs: (addr: string) => Promise<UTxO[]> },
  vaultScriptAddress: string,
): Promise<UTxO | undefined> {
  const list = await fetcher.fetchAddressUTxOs(vaultScriptAddress);
  return list.find(
    u => u.input.txHash === VAULT_TX_HASH && u.input.outputIndex === VAULT_OUTPUT_INDEX,
  );
}

function findReceiptUtxo(walletUtxos: UTxO[]): UTxO | undefined {
  return walletUtxos.find(
    u => u.input.txHash === RECEIPT_TX_HASH && u.input.outputIndex === RECEIPT_OUTPUT_INDEX,
  );
}

async function main() {
  const apiKey = process.env.BLOCKFROST_API_KEY;
  if (!apiKey) throw new Error("BLOCKFROST_API_KEY missing in .env");

  const words = process.env.WALLET_MNEMONIC?.split(/\s+/).filter(Boolean);
  if (!words?.length) throw new Error("WALLET_MNEMONIC missing in .env");

  const { BlockfrostProvider, MeshWallet } = await import("@meshsdk/core");

  const networkId = PROTOCOL.NETWORK_ID as 0 | 1;
  const provider    = new BlockfrostProvider(apiKey);
  const wallet      = new MeshWallet({
    networkId,
    fetcher:   provider,
    submitter: provider,
    key:       { type: "mnemonic", words },
  });

  const scriptParams = {
    adaNft:              ORACLE_CONFIG.ADA_NFT_POLICY,
    xauNft:              ORACLE_CONFIG.XAU_NFT_POLICY,
    xagNft:              ORACLE_CONFIG.XAG_NFT_POLICY,
    liquidationBonusBps: PROTOCOL.LIQUIDATION_BONUS_BPS,
  };

  const scripts   = deriveAllScripts(scriptParams);
  const vaultAddr = scriptAddress(scripts.spend.plutusScript, networkId);

  const oracleRefs    = await fetchOracleRefs(provider, ASSET_CLASS);
  const changeAddress = await wallet.getChangeAddress();
  const walletUtxos   = await wallet.getUtxos();

  async function signSubmit(unsignedHex: string, label: string) {
    const signed = await wallet.signTx(unsignedHex);
    const txHash   = await wallet.submitTx(signed);
    console.log(`[${label}] submitted: ${txHash}`);
  }

  // ─────────────────────────────────────────────────────────────
  // Uncomment ONE block below (and fill TODOs / constants above).
  // ─────────────────────────────────────────────────────────────

  // --- 1) mintVault — open vault + mint synths ----------------------------
  // Pick a wallet UTxO with enough ADA (not necessarily collateral slot).
  const seedUtxo = walletUtxos[0]!;
  const unsigned = await mintVault(
    {
      seedUtxo,
      collateralLovelace: 5_000_000n, // lovelace locked in vault
      synthAmount:          1_000_000n, // 6 dp synth units
      assetClass:           ASSET_CLASS,
      ownerAddress:         changeAddress,
      oracleRefs,
      scriptParams,
      networkId,
    },
    wallet,
    provider,
  );
  await signSubmit(unsigned, "mintVault");

  // --- 2) burnSynth — repay synth (partial or full) ------------------------
  // const vaultUtxo = await findVaultUtxo(provider, vaultAddr);
  // if (!vaultUtxo?.output.plutusData) throw new Error("Set VAULT_TX_HASH / VAULT_OUTPUT_INDEX");
  // const unsigned = await burnSynth(
  //   {
  //     vaultUtxo,
  //     burnAmount:   500_000n, // must be ≤ datum.synth_minted
  //     ownerAddress: changeAddress,
  //     oracleRefs,
  //     scriptParams,
  //     networkId,
  //   },
  //   wallet,
  //   provider,
  // );
  // await signSubmit(unsigned, "burnSynth");

  // --- 3) withdrawCollateral — change ADA locked (keeps ≥ MCR on-chain) -----
  // const vaultUtxo = await findVaultUtxo(provider, vaultAddr);
  // if (!vaultUtxo?.output.plutusData) throw new Error("Set VAULT_TX_HASH / VAULT_OUTPUT_INDEX");
  // const unsigned = await withdrawCollateral(
  //   {
  //     vaultUtxo,
  //     newCollateral: 6_000_000n, // target lovelace in vault after tx (≥ 2 ADA)
  //     ownerAddress:  changeAddress,
  //     oracleRefs,
  //     scriptParams,
  //     networkId,
  //   },
  //   wallet,
  //   provider,
  // );
  // await signSubmit(unsigned, "withdrawCollateral");

  // --- 4) liquidate — liquidator wallet burns synth, takes collateral -------
  // const vaultUtxo = await findVaultUtxo(provider, vaultAddr);
  // if (!vaultUtxo?.output.plutusData) throw new Error("Set VAULT_TX_HASH / VAULT_OUTPUT_INDEX");
  // const unsigned = await liquidate(
  //   {
  //     vaultUtxo,
  //     synthToBurn:         1_000_000n, // use datum.synth_minted for full liq
  //     liquidatorAddress:   changeAddress,
  //     oracleRefs,
  //     scriptParams,
  //     networkId,
  //   },
  //   wallet,
  //   provider,
  // );
  // await signSubmit(unsigned, "liquidate");

  // --- 5) closeVault — synth_minted must be 0; burns NFT pair --------------
  // const vaultUtxo   = await findVaultUtxo(provider, vaultAddr);
  // const receiptUtxo = findReceiptUtxo(walletUtxos);
  // if (!vaultUtxo?.output.plutusData) throw new Error("Set VAULT_TX_HASH / VAULT_OUTPUT_INDEX");
  // if (!receiptUtxo) throw new Error("Set RECEIPT_TX_HASH / RECEIPT_OUTPUT_INDEX");
  // const unsigned = await closeVault(
  //   {
  //     vaultUtxo,
  //     receiptUtxo,
  //     ownerAddress: changeAddress,
  //     oracleRefs,
  //     scriptParams,
  //     networkId,
  //   },
  //   wallet,
  //   provider,
  // );
  // await signSubmit(unsigned, "closeVault");

  console.log(
    "Nothing ran — open src/runTransactions.ts, uncomment one block in main(), set constants, then run again.",
  );
}

main().catch(err => {
  console.error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
