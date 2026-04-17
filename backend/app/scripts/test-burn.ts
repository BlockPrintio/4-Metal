import "dotenv/config";
import { MeshWallet } from "@meshsdk/core";
import { burn } from "../burn";
import { getProvider } from "../lib/tx-builder";
import type { SyntheticAsset } from "../lib/types";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in environment.`);
  return value;
}

async function main() {
  const provider = getProvider();
  const mnemonic = env("MNEMONIC").trim().split(/\s+/);
  const syntheticAsset = (process.env.TEST_ASSET ?? "sXAU") as SyntheticAsset;
  const burnAmount = BigInt(process.env.TEST_BURN_AMOUNT ?? "1000000");

  const wallet = new MeshWallet({
    networkId: 0,
    fetcher: provider,
    submitter: provider,
    key: { type: "mnemonic", words: mnemonic },
  });

  const txHash = await burn({
    wallet,
    syntheticAsset,
    burnAmount,
  });
  console.log(`Burn txHash: ${txHash}`);
  console.log(`Preview explorer: https://preview.cardanoscan.io/transaction/${txHash}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
