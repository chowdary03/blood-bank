/**
 * export-addresses.js
 *
 * After running:
 *   npx hardhat ignition deploy ignition/modules/BloodBank.js [--network <name>]
 *
 * Run this script to automatically patch frontend/src/contracts.js with the
 * real on-chain addresses:
 *
 *   node scripts/export-addresses.js [--network localhost|sepolia|mainnet]
 *
 * The script reads ignition/deployments/chain-<id>/deployed_addresses.json
 * and replaces the ADDRESSES block in contracts.js in-place.
 */

const fs   = require("fs");
const path = require("path");

// ── network → chainId map ─────────────────────────────────────────────────
const CHAIN_IDS = {
  localhost : 31337,
  hardhat   : 31337,
  sepolia   : 11155111,
  mainnet   : 1,
};

function parseNetworkArg() {
  const idx = process.argv.indexOf("--network");
  return idx !== -1 ? process.argv[idx + 1] : "localhost";
}

function main() {
  const network = parseNetworkArg();
  const chainId = CHAIN_IDS[network];
  if (!chainId) {
    throw new Error(`Unknown network "${network}". Add it to CHAIN_IDS in this script.`);
  }

  // ── Read ignition deployment output ──────────────────────────────────────
  const deployedPath = path.join(
    __dirname, "..", "ignition", "deployments",
    `chain-${chainId}`, "deployed_addresses.json",
  );

  if (!fs.existsSync(deployedPath)) {
    throw new Error(
      `No deployment found at:\n  ${deployedPath}\n` +
      `Run "npx hardhat ignition deploy ignition/modules/BloodBank.js --network ${network}" first.`,
    );
  }

  const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));

  // Keys are "ModuleName#ContractName" — extract the contract name part
  const addresses = {};
  for (const [key, addr] of Object.entries(deployed)) {
    const contractName = key.split("#")[1];
    if (contractName) addresses[contractName] = addr;
  }

  // YodaToken is external (professor-issued) — inject its known address
  const EXTERNAL_YODA = "0xbd27d0b7F9fedb5A2A2C3ceF5dC9c70f3CF64Af2";
  if (!addresses["YodaToken"]) {
    addresses["YodaToken"] = EXTERNAL_YODA;
  }

  const required = ["YodaToken", "BloodRegistry", "BloodDonation", "BloodMarket"];
  for (const name of required) {
    if (!addresses[name]) {
      throw new Error(
        `Contract "${name}" not found in deployed_addresses.json.\n` +
        `Available keys: ${Object.keys(deployed).join(", ")}`,
      );
    }
  }

  console.log("Deployed addresses:");
  required.forEach((n) => console.log(`  ${n}: ${addresses[n]}`));

  // ── Patch frontend/src/contracts.js ──────────────────────────────────────
  const contractsPath = path.join(__dirname, "..", "frontend", "src", "contracts.js");
  if (!fs.existsSync(contractsPath)) {
    throw new Error(`contracts.js not found at ${contractsPath}`);
  }

  let content = fs.readFileSync(contractsPath, "utf8");

  const newBlock =
    `export const ADDRESSES = {\n` +
    `  YodaToken:     "${addresses.YodaToken}",\n` +
    `  BloodRegistry: "${addresses.BloodRegistry}",\n` +
    `  BloodMarket:   "${addresses.BloodMarket}",\n` +
    `  BloodDonation: "${addresses.BloodDonation}",\n` +
    `};`;

  content = content.replace(/export const ADDRESSES = \{[\s\S]*?\};/, newBlock);
  fs.writeFileSync(contractsPath, content, "utf8");

  console.log(`\n✓ Patched frontend/src/contracts.js for network "${network}"`);
}

try {
  main();
} catch (err) {
  console.error("\n✗", err.message);
  process.exit(1);
}
