# Backend Transaction Layer

## Setup
- `cd backend`
- `npm install`
- Ensure `contracts/plutus.json` exists at repo root.

## Environment variables
- Copy `.env.example` to `.env`.
- Fill `BLOCKFROST_PROJECT_ID_PREVIEW`, `MNEMONIC`, and all `FEED_*` values.

## Run mint test
- `npm run test:mint`
- Optional env overrides: `TEST_ASSET=sXAU|sXAG`, `TEST_COLLATERAL_ADA=25`.

## Run burn test
- `npm run test:burn`
- Optional env overrides: `TEST_ASSET=sXAU|sXAG`, `TEST_BURN_AMOUNT=1000000`.
