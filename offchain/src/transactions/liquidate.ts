// ============================================================
// liquidate.ts  —  Liquidate an undercollateralised vault
// ============================================================
// On-chain condition: collateral_ratio(datum) < 150%.
// Transaction flow (partial liquidation):
//   Inputs:  vault UTxO (script)
//   Burns:   synthToBurn synth tokens
//   Outputs: continuation vault UTxO with reduced debt
//
// Transaction flow (full liquidation, synthToBurn == synth_minted):
//   No continuation output — all collateral goes to liquidator via change.
// ============================================================

import {
  MeshTxBuilder,
  IWallet,
  UTxO,
  deserializeDatum,
} from "@meshsdk/core";

import {
  deriveAllScripts,
  scriptAddress,
  rewardAddress,
  AllScriptParams,
} from "../scripts/scripts.js";
import {
  serVaultDatum,
  serLiquidateRedeemer,
  serBurnSynthRedeemer,
  parseVaultDatum,
} from "../types.js";
import {
  OracleRefs,
  ORACLE_INDICES,
  addOracleRefs,
  oracleValidityRange,
} from "../services/oracle.js";
import { SYNTH_NAMES } from "../config.js";

export interface LiquidateParams {
  vaultUtxo:          UTxO;
  synthToBurn:        bigint;   // use datum.synth_minted for full liquidation
  liquidatorAddress:  string;
  oracleRefs:         OracleRefs;
  scriptParams:       AllScriptParams;
  networkId:          0 | 1;
}

export async function liquidate(
  params: LiquidateParams,
  wallet: IWallet,
  fetcher: any,
): Promise<string> {
  const { vaultUtxo, synthToBurn, liquidatorAddress, oracleRefs, scriptParams, networkId } = params;

  const { nft, router, spend, mint } = deriveAllScripts(scriptParams);
  const vaultAddr  = scriptAddress(spend.plutusScript, networkId);
  const routerAddr = rewardAddress(router.hash, networkId);
  const range      = oracleValidityRange(oracleRefs);
  const collateral = await getCollateral(wallet);
  const changeAddr = await wallet.getChangeAddress();

  const raw    = deserializeDatum(vaultUtxo.output.plutusData!);
  const datum  = parseVaultDatum(raw);
  const isFull = synthToBurn >= datum.synth_minted;

  if (synthToBurn > datum.synth_minted) {
    throw new Error(`synthToBurn ${synthToBurn} exceeds vault debt ${datum.synth_minted}`);
  }

  const synthName       = SYNTH_NAMES[datum.asset_class];
  const liquidateRedeem = serLiquidateRedeemer(ORACLE_INDICES);
  const burnRedeem      = serBurnSynthRedeemer();
  const vaultLovelace   = vaultUtxo.output.amount.find(a => a.unit === "lovelace")?.quantity ?? "0";

  const builder = addOracleRefs(new MeshTxBuilder({ fetcher, evaluator: fetcher }), oracleRefs)

    // Spend vault via router
    .spendingPlutusScriptV3()
    .txIn(vaultUtxo.input.txHash, vaultUtxo.input.outputIndex)
    .txInInlineDatumPresent()
    .txInRedeemerValue(liquidateRedeem, "JSON")
    .spendingScript(spend.cbor)

    .withdrawalPlutusScriptV3()
    .withdrawal(routerAddr, "0")
    .withdrawalRedeemerValue(liquidateRedeem, "JSON")
    .withdrawalScript(router.cbor)

    // Burn synths
    .mintPlutusScriptV3()
    .mint(`-${synthToBurn}`, mint.hash, synthName)
    .mintingScript(mint.cbor)
    .mintRedeemerValue(burnRedeem, "JSON");

  // Partial liquidation: continuation vault output required
  if (!isFull) {
    const newDatum = serVaultDatum({
      ...datum,
      synth_minted: datum.synth_minted - synthToBurn,
    });
    builder
      .txOut(vaultAddr, [
        { unit: "lovelace",                      quantity: vaultLovelace },
        { unit: nft.hash + datum.vault_nft_name, quantity: "1" },
      ])
      .txOutInlineDatumValue(newDatum, "JSON");
  }

  return builder
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .invalidBefore(range.invalidBefore)
    .invalidHereafter(range.invalidHereafter)
    .changeAddress(changeAddr)
    .setNetwork(networkId === 0 ? "preprod" : "mainnet")
    .complete();
}

async function getCollateral(wallet: IWallet): Promise<UTxO> {
  const c = await wallet.getCollateral();
  if (!c?.length) throw new Error("No collateral UTxO");
  return c[0]!;
}