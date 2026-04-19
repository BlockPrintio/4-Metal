import {
  MeshTxBuilder,
  IWallet,
  UTxO,
} from "@meshsdk/core";
import { deserializeAddress } from "@meshsdk/core";

import {
  deriveAllScripts,
  scriptAddress,
  AllScriptParams,
} from "../scripts/scripts.js";
import {
  serVaultDatum,
  serMintVaultNftRedeemer,
  serMintSynthRedeemer,
  deriveVaultTokenName,
} from "../types.js";
import {
  OracleRefs,
  ORACLE_INDICES,
  addOracleRefs,
  oracleValidityRange,
} from "../services/oracle.js";
import { SYNTH_NAMES } from "../config.js";

export interface MintVaultParams {
  seedUtxo: UTxO;
  collateralLovelace: bigint;
  synthAmount: bigint;
  assetClass: "XAU" | "XAG";
  ownerAddress: string;
  oracleRefs: OracleRefs;
  scriptParams: AllScriptParams;
  networkId: 0 | 1;
}

export async function mintVault(
  params: MintVaultParams,
  wallet: IWallet,
  fetcher: any,
): Promise<string> {
  const { seedUtxo, collateralLovelace, synthAmount, assetClass, ownerAddress, oracleRefs, scriptParams, networkId } = params;

  // Derive scripts & addresses
  const { nft, spend, mint } = deriveAllScripts(scriptParams);
  const vaultAddr = scriptAddress(spend.plutusScript, networkId);
  const range = oracleValidityRange(oracleRefs);
  const synthName = SYNTH_NAMES[assetClass];
  const vaultNftName = deriveVaultTokenName(seedUtxo.input.txHash, seedUtxo.input.outputIndex);
  const ownerPkh = deserializeAddress(ownerAddress).pubKeyHash;

  // Serialize redeemers & datum
  const vaultDatum = serVaultDatum({
    owner: ownerPkh,
    collateral_amount: collateralLovelace,
    synth_minted: synthAmount,
    asset_class: assetClass,
    vault_nft_name: vaultNftName,
  });

  const vaultNftRedeemer = serMintVaultNftRedeemer(seedUtxo.input.txHash, seedUtxo.input.outputIndex);
  const synthMintRedeemer = serMintSynthRedeemer(ORACLE_INDICES); // oracle indices

  // Build tx
  const txBuilder = new MeshTxBuilder({ fetcher, evaluator: fetcher });
  const collateral = (await wallet.getCollateral())?.[0];
  if (!collateral) throw new Error("No collateral");

  const changeAddr = await wallet.getChangeAddress();

  const unsigned = await addOracleRefs(txBuilder, oracleRefs)
    .requiredSignerHash(ownerPkh)
    .txIn(seedUtxo.input.txHash, seedUtxo.input.outputIndex)
    
    // Mint Vault NFT (qty 2: 1 vault, 1 receipt)
    .mintPlutusScriptV3()
    .mint("2", nft.hash, vaultNftName)
    .mintingScript(nft.cbor)
    .mintRedeemerValue(vaultNftRedeemer, "JSON")
    
    // Mint synth tokens
    .mintPlutusScriptV3()
    .mint(synthAmount.toString(), mint.hash, synthName)
    .mintingScript(mint.cbor)
    .mintRedeemerValue(synthMintRedeemer, "JSON")
    
    // Vault UTxO: collateral + 1 NFT
    .txOut(vaultAddr, [
      { unit: "lovelace", quantity: collateralLovelace.toString() },
      { unit: nft.hash + vaultNftName, quantity: "1" },
    ])
    .txOutInlineDatumValue(vaultDatum, "JSON")
    
    // Owner UTxO: receipt NFT + synth
    .txOut(ownerAddress, [
      { unit: nft.hash + vaultNftName, quantity: "1" },
      { unit: mint.hash + synthName, quantity: synthAmount.toString() },
    ])
    
    .txInCollateral(collateral.input.txHash, collateral.input.outputIndex)
    .invalidBefore(range.invalidBefore)
    .invalidHereafter(range.invalidHereafter)
    .changeAddress(changeAddr)
    .setNetwork(networkId === 0 ? "preprod" : "mainnet")
    .complete();

  return unsigned;
}