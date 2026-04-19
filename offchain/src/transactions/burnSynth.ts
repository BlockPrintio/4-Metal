// ============================================================
// burnSynth.ts  —  Repay synthetic debt (partial or full)
// ============================================================
// Transaction flow:
//   Inputs:  vault UTxO (via vault_spend → vault_router withdrawal)
//   Burns:   N synth tokens (synth_mint BurnSynth redeemer)
//   Outputs: vault UTxO with updated synth_minted (continuation)
//
// When synth_minted reaches 0, call closeVault() to reclaim ADA.
// ============================================================

import {
  MeshTxBuilder,
  IWallet,
  UTxO,
  deserializeDatum,
} from "@meshsdk/core";
import {
  serVaultDatum,
  serWithdrawRedeemer,
  serBurnSynthRedeemer,
  parseVaultDatum,
} from "../types.js";
import {
  OracleRefs,
  ORACLE_INDICES,
  addOracleRefs,
  oracleValidityRange,
} from "../services/oracle.js";
import {
  deriveAllScripts,
  scriptAddress,
  rewardAddress,
  AllScriptParams,
} from "../scripts/scripts.js";
import { SYNTH_NAMES } from "../config.js";

export interface BurnSynthParams {
  vaultUtxo:     UTxO;
  burnAmount:    bigint;
  ownerAddress:  string;
  oracleRefs:    OracleRefs;
  scriptParams:  AllScriptParams;
  networkId:     0 | 1;
}

export async function burnSynth(
  params: BurnSynthParams,
  wallet: IWallet,
  fetcher: any,
): Promise<string> {
  const { vaultUtxo, burnAmount, ownerAddress, oracleRefs, scriptParams, networkId } = params;

  const { nft, router, spend, mint } = deriveAllScripts(scriptParams);
  const vaultAddr   = scriptAddress(spend.plutusScript, networkId);
  const routerAddr  = rewardAddress(router.hash, networkId);
  const range       = oracleValidityRange(oracleRefs);
  const collateral  = await getCollateral(wallet);
  const changeAddr  = await wallet.getChangeAddress();

  // Parse existing vault state
  const raw       = deserializeDatum(vaultUtxo.output.plutusData!);
  const datum     = parseVaultDatum(raw);
  const synthName = SYNTH_NAMES[datum.asset_class];

  if (burnAmount > datum.synth_minted) {
    throw new Error(`Burn amount ${burnAmount} exceeds minted ${datum.synth_minted}`);
  }

  // Updated datum — synth_minted reduced
  const newDatum = serVaultDatum({
    ...datum,
    synth_minted: datum.synth_minted - burnAmount,
  });

  const vaultRedeemer = serWithdrawRedeemer(ORACLE_INDICES);
  const burnRedeemer  = serBurnSynthRedeemer();

  const vaultLovelace = vaultUtxo.output.amount.find(a => a.unit === "lovelace")?.quantity ?? "0";

  const unsigned = await addOracleRefs(new MeshTxBuilder({ fetcher, evaluator: fetcher }), oracleRefs)
    .requiredSignerHash(datum.owner)

    // Spend vault UTxO via thin spend router
    .spendingPlutusScriptV3()
    .txIn(vaultUtxo.input.txHash, vaultUtxo.input.outputIndex)
    .txInInlineDatumPresent()
    .txInRedeemerValue(vaultRedeemer, "JSON")
    .spendingScript(spend.cbor)

    // Withdrawal triggers vault_router logic
    .withdrawalPlutusScriptV3()
    .withdrawal(routerAddr, "0")
    .withdrawalRedeemerValue(vaultRedeemer, "JSON")
    .withdrawalScript(router.cbor)

    // Burn synth tokens
    .mintPlutusScriptV3()
    .mint(`-${burnAmount}`, mint.hash, synthName)
    .mintingScript(mint.cbor)
    .mintRedeemerValue(burnRedeemer, "JSON")

    // Continuation vault output (same collateral, updated datum)
    .txOut(vaultAddr, [
      { unit: "lovelace",                      quantity: vaultLovelace },
      { unit: nft.hash + datum.vault_nft_name, quantity: "1" },
    ])
    .txOutInlineDatumValue(newDatum, "JSON")

    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .invalidBefore(range.invalidBefore)
    .invalidHereafter(range.invalidHereafter)
    .changeAddress(changeAddr)
    .setNetwork(networkId === 0 ? "preprod" : "mainnet")
    .complete();

  return unsigned;
}

async function getCollateral(wallet: IWallet): Promise<UTxO> {
  const c = await wallet.getCollateral();
  if (!c?.length) throw new Error("No collateral UTxO");
  return c[0]!;
}