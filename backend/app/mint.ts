import type { IWallet } from "@meshsdk/core";
import {
  COLLATERAL_RATIO,
  MINT_POLICY_CBOR,
  SCALE,
  VAULT_SCRIPT_ADDRESS,
} from "./lib/config";
import { getAdaPricePerSynthetic } from "./lib/oracle";
import {
  attachOracleReferenceInputs,
  buildMintRedeemer,
  buildVaultDatum,
  getTxBuilder,
  getProvider,
  makeLogger,
  ownerPkhFromAddress,
  syntheticUnit,
} from "./lib/tx-builder";
import type { SyntheticAsset, VaultDatum } from "./lib/types";

export async function mint(params: {
  wallet: IWallet;
  syntheticAsset: SyntheticAsset;
  collateralAda: number;
}) {
  const log = makeLogger("MINT");
  log("Starting mint flow", {
    syntheticAsset: params.syntheticAsset,
    collateralAda: params.collateralAda,
  });

  const changeAddress = await params.wallet.getChangeAddress();
  const ownerPkh = ownerPkhFromAddress(changeAddress);
  log("Wallet context loaded", { ownerPkh, changeAddress });

  const collateralLovelace = BigInt(Math.trunc(params.collateralAda * 1_000_000));
  if (collateralLovelace <= 0n) {
    throw new Error("collateralAda must convert to positive lovelace.");
  }

  const provider = getProvider();
  const adaPricePerSynthetic = await getAdaPricePerSynthetic(provider, params.syntheticAsset);
  if (adaPricePerSynthetic <= 0n) {
    throw new Error("Oracle-derived synthetic/ADA price must be positive.");
  }
  log("Fetched oracle-derived synthetic price", {
    syntheticAsset: params.syntheticAsset,
    adaPricePerSynthetic: adaPricePerSynthetic.toString(),
  });

  const mintableAmount =
    (collateralLovelace * 100n * SCALE) /
    (COLLATERAL_RATIO * adaPricePerSynthetic);
  if (mintableAmount <= 0n) {
    throw new Error("Computed mintable amount is zero.");
  }
  log("Computed mintable amount", { mintableAmount: mintableAmount.toString() });

  const vaultDatum: VaultDatum = {
    owner: ownerPkh,
    syntheticAsset: params.syntheticAsset,
    collateralLovelace,
    mintedAmount: mintableAmount,
    mintPriceAdaScaled: adaPricePerSynthetic,
  };

  const unit = syntheticUnit(params.syntheticAsset);
  const txBuilder = getTxBuilder();
  txBuilder.setInitiator(params.wallet);

  const walletUtxos = await params.wallet.getUtxos();
  if (!walletUtxos.length) {
    throw new Error("Wallet has no UTxOs to fund collateral and fees.");
  }

  attachOracleReferenceInputs(txBuilder)
    .selectUtxosFrom(walletUtxos)
    .mintPlutusScriptV3()
    .mint("+" + mintableAmount.toString(), unit)
    .mintingScript(MINT_POLICY_CBOR)
    .mintRedeemerValue(
      buildMintRedeemer({
        kind: "MintTokens",
        amount: mintableAmount,
        asset: params.syntheticAsset,
      }),
    )
    .txOut(VAULT_SCRIPT_ADDRESS, [
      { unit: "lovelace", quantity: collateralLovelace.toString() },
      { unit, quantity: mintableAmount.toString() },
    ])
    .txOutInlineDatumValue(buildVaultDatum(vaultDatum))
    .requiredSignerHash(ownerPkh)
    .changeAddress(changeAddress)
    .metadataValue(674, { action: "mint", syntheticAsset: params.syntheticAsset });

  const unsignedTx = await txBuilder.complete();
  log("Built unsigned transaction");

  const signedTx = await params.wallet.signTx(unsignedTx, true);
  const txHash = await params.wallet.submitTx(signedTx);
  log("Submitted mint transaction", { txHash });
  return txHash;
}
