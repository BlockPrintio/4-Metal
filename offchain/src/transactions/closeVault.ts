// ============================================================
// closeVault.ts  —  Close a zero-debt vault, reclaim collateral
// ============================================================
// Precondition: vault synth_minted == 0 (enforced on-chain).
// Transaction flow:
//   Inputs:  vault UTxO  (script)
//            receipt UTxO (owner wallet, holds receipt NFT)
//   Burns:   qty -2 of vault_nft_name (vault NFT + receipt token)
//   Outputs: all ADA returns to changeAddress via .changeAddress()
// ============================================================

import {
  MeshTxBuilder,
  IWallet,
  UTxO,
  deserializeDatum,
} from "@meshsdk/core";

import {
  deriveAllScripts,
  rewardAddress,
  AllScriptParams,
} from "../scripts/scripts.js";
import {
  serWithdrawRedeemer,
  serBurnVaultNftRedeemer,
  parseVaultDatum,
} from "../types.js";
import {
  OracleRefs,
  ORACLE_INDICES,
  addOracleRefs,
  oracleValidityRange,
} from "../services/oracle.js";


export interface CloseVaultParams {
  vaultUtxo:    UTxO;
  receiptUtxo:  UTxO;   // wallet UTxO containing the receipt NFT
  ownerAddress: string;
  oracleRefs:   OracleRefs;
  scriptParams: AllScriptParams;
  networkId:    0 | 1;
}

export async function closeVault(
  params: CloseVaultParams,
  wallet: IWallet,
  fetcher: any,
): Promise<string> {
  const { vaultUtxo, receiptUtxo, ownerAddress, oracleRefs, scriptParams, networkId } = params;

  const { nft, router, spend } = deriveAllScripts(scriptParams);
  const routerAddr = rewardAddress(router.hash, networkId);
  const range      = oracleValidityRange(oracleRefs);
  const collateral = await getCollateral(wallet);
  const changeAddr = await wallet.getChangeAddress();

  const raw   = deserializeDatum(vaultUtxo.output.plutusData!);
  const datum = parseVaultDatum(raw);

  if (datum.synth_minted !== 0n) {
    throw new Error(`Vault still has ${datum.synth_minted} synth debt. Burn first.`);
  }

  const vaultRedeemer    = serWithdrawRedeemer(ORACLE_INDICES);
  const burnNftRedeemer  = serBurnVaultNftRedeemer();

  const unsigned = await addOracleRefs(new MeshTxBuilder({ fetcher, evaluator: fetcher }), oracleRefs)
    .requiredSignerHash(datum.owner)

    // Spend vault UTxO
    .spendingPlutusScriptV3()
    .txIn(vaultUtxo.input.txHash, vaultUtxo.input.outputIndex)
    .txInInlineDatumPresent()
    .txInRedeemerValue(vaultRedeemer, "JSON")
    .spendingScript(spend.cbor)

    // Withdrawal triggers vault_router (Withdraw path: no continuation needed since synth=0 & nft burned)
    .withdrawalPlutusScriptV3()
    .withdrawal(routerAddr, "0")
    .withdrawalRedeemerValue(vaultRedeemer, "JSON")
    .withdrawalScript(router.cbor)

    // Spend receipt UTxO from wallet (proves owner has the receipt)
    .txIn(receiptUtxo.input.txHash, receiptUtxo.input.outputIndex)

    // Burn vault NFT + receipt token (qty=-2, same token name)
    .mintPlutusScriptV3()
    .mint("-2", nft.hash, datum.vault_nft_name)
    .mintingScript(nft.cbor)
    .mintRedeemerValue(burnNftRedeemer, "JSON")

    // No explicit vault output needed — ADA flows to change
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