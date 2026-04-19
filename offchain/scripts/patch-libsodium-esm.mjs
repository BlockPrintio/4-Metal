/**
 * libsodium-wrappers-sumo (ESM) imports ./libsodium-sumo.mjs next to libsodium-wrappers.mjs,
 * but npm does not ship that sibling file. The real wasm bundle lives in the libsodium-sumo
 * package. Copy it so MeshWallet / @cardano-sdk/crypto can await sodium.ready under Node ESM.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(
  root,
  "node_modules/libsodium-sumo/dist/modules-sumo-esm/libsodium-sumo.mjs",
);
const dst = path.join(
  root,
  "node_modules/libsodium-wrappers-sumo/dist/modules-sumo-esm/libsodium-sumo.mjs",
);

if (!fs.existsSync(src)) {
  console.warn("[patch-libsodium-esm] skip: missing", src);
  process.exit(0);
}

fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.copyFileSync(src, dst);
console.log("[patch-libsodium-esm] ok:", dst);
