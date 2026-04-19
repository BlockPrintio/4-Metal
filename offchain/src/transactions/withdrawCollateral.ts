// ============================================================
// withdrawCollateral.ts  —  Adjust vault collateral (add/remove ADA)
// ============================================================
// On-chain: the WR (Withdraw) redeemer validates the continuation
// vault remains at or above 150% MCR with updated collateral.
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
  serWithdrawRedeemer,
  parseVaultDatum,
} from "../types.js";
import {
  OracleRefs,
  ORACLE_INDICES,
  addOracleRefs,
  oracleValidityRange,
} from "../services/oracle.js";


export interface WithdrawCollateralParams {
  vaultUtxo:         UTxO;
  newCollateral:     bigint;   // desired lovelace after the tx
  ownerAddress:      string;
  oracleRefs:        OracleRefs;
  scriptParams:      AllScriptParams;
  networkId:         0 | 1;
}

export async function withdrawCollateral(
  params: WithdrawCollateralParams,
  wallet: IWallet,
  fetcher: any,
): Promise<string> {
  const { vaultUtxo, newCollateral, ownerAddress, oracleRefs, scriptParams, networkId } = params;

  const { nft, router, spend } = deriveAllScripts(scriptParams);
  const vaultAddr  = scriptAddress(spend.plutusScript, networkId);
  const routerAddr = rewardAddress(router.hash, networkId);
  const range      = oracleValidityRange(oracleRefs);
  const collateral = await getCollateral(wallet);
  const changeAddr = await wallet.getChangeAddress();

  const raw   = deserializeDatum(vaultUtxo.output.plutusData!);
  const datum = parseVaultDatum(raw);

  // On-chain enforces 150% — we guard here for a friendlier error
  if (newCollateral < 2_000_000n) {
    throw new Error("New collateral must be at least 2 ADA (min UTxO)");
  }

  const newDatum = serVaultDatum({ ...datum, collateral_amount: newCollateral });
  const vaultRedeemer = serWithdrawRedeemer(ORACLE_INDICES);

  const unsigned = await addOracleRefs(new MeshTxBuilder({ fetcher, evaluator: fetcher }), oracleRefs)
    .requiredSignerHash(datum.owner)

    .spendingPlutusScriptV3()
    .txIn(vaultUtxo.input.txHash, vaultUtxo.input.outputIndex)
    .txInInlineDatumPresent()
    .txInRedeemerValue(vaultRedeemer, "JSON")
    .spendingScript(spend.cbor)

    .withdrawalPlutusScriptV3()
    .withdrawal(routerAddr, "0")
    .withdrawalRedeemerValue(vaultRedeemer, "JSON")
    .withdrawalScript(router.cbor)

    // Vault continuation output with updated collateral
    .txOut(vaultAddr, [
      { unit: "lovelace",                      quantity: newCollateral.toString() },
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