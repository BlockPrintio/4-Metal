import type { IWallet } from "@meshsdk/core";
import { MINT_POLICY_CBOR, VAULT_SCRIPT_CBOR, VAULT_SCRIPT_ADDRESS } from "./lib/config";
import { getAdaPricePerSynthetic } from "./lib/oracle";
import {
  attachOracleReferenceInputs,
  buildMintRedeemer,
  buildVaultDatum,
  buildVaultRedeemer,
  findVaultUtxoForOwner,
  getTxBuilder,
  getProvider,
  makeLogger,
  ownerPkhFromAddress,
  syntheticUnit,
} from "./lib/tx-builder";
import type { SyntheticAsset, VaultDatum } from "./lib/types";

export async function burn(params: {
  wallet: IWallet;
  syntheticAsset: SyntheticAsset;
  burnAmount: bigint;
}) {
  const log = makeLogger("BURN");
  log("Starting burn flow", {
    syntheticAsset: params.syntheticAsset,
    burnAmount: params.burnAmount.toString(),
  });

  if (params.burnAmount <= 0n) {
    throw new Error("burnAmount must be positive.");
  }

  const changeAddress = await params.wallet.getChangeAddress();
  const ownerPkh = ownerPkhFromAddress(changeAddress);
  log("Wallet context loaded", { ownerPkh, changeAddress });

  const provider = getProvider();
  const { utxo: vaultUtxo, datum: vaultDatum } = await findVaultUtxoForOwner(
    provider,
    ownerPkh,
    params.syntheticAsset,
  );
  if (params.burnAmount > vaultDatum.mintedAmount) {
    throw new Error("burnAmount exceeds minted amount in vault.");
  }

  await getAdaPricePerSynthetic(provider, params.syntheticAsset);
  log("Fetched oracle-derived synthetic price", {
    syntheticAsset: params.syntheticAsset,
    status: "ok",
  });

  const collateralToRelease =
    (vaultDatum.collateralLovelace * params.burnAmount) / vaultDatum.mintedAmount;
  const updatedMinted = vaultDatum.mintedAmount - params.burnAmount;
  const updatedCollateral = vaultDatum.collateralLovelace - collateralToRelease;
  const unit = syntheticUnit(params.syntheticAsset);
  log("Computed burn deltas", {
    collateralToRelease: collateralToRelease.toString(),
    updatedMinted: updatedMinted.toString(),
    updatedCollateral: updatedCollateral.toString(),
  });

  const walletUtxos = await params.wallet.getUtxos();
  const txBuilder = getTxBuilder();
  txBuilder.setInitiator(params.wallet);

  attachOracleReferenceInputs(txBuilder)
    .selectUtxosFrom(walletUtxos)
    .spendingPlutusScriptV3()
    .txIn(
      vaultUtxo.input.txHash,
      vaultUtxo.input.outputIndex,
      vaultUtxo.output.amount,
      vaultUtxo.output.address,
    )
    .txInInlineDatumPresent()
    .txInRedeemerValue(buildVaultRedeemer({ kind: "Burn", burnAmount: params.burnAmount }))
    .txInScript(VAULT_SCRIPT_CBOR)
    .mintPlutusScriptV3()
    .mint("-" + params.burnAmount.toString(), unit)
    .mintingScript(MINT_POLICY_CBOR)
    .mintRedeemerValue(
      buildMintRedeemer({
        kind: "BurnTokens",
        amount: params.burnAmount,
        asset: params.syntheticAsset,
      }),
    )
    .requiredSignerHash(ownerPkh)
    .changeAddress(changeAddress)
    .metadataValue(674, { action: "burn", syntheticAsset: params.syntheticAsset });

  if (updatedMinted > 0n) {
    const updatedDatum: VaultDatum = {
      ...vaultDatum,
      collateralLovelace: updatedCollateral,
      mintedAmount: updatedMinted,
    };
    txBuilder
      .txOut(VAULT_SCRIPT_ADDRESS, [
        { unit: "lovelace", quantity: updatedCollateral.toString() },
        { unit, quantity: updatedMinted.toString() },
      ])
      .txOutInlineDatumValue(buildVaultDatum(updatedDatum));
  }

  const unsignedTx = await txBuilder.complete();
  log("Built unsigned transaction");

  const signedTx = await params.wallet.signTx(unsignedTx, true);
  const txHash = await params.wallet.submitTx(signedTx);
  log("Submitted burn transaction", { txHash });
  return txHash;
}
