// ─────────────────────────────────────────────────────────────────────────────
// Hardhat Ignition – BloodBank Deployment Module
//
// Uses the EXTERNAL professor-issued YodaToken — we do NOT deploy our own.
// Only deploys: BloodRegistry, BloodDonation, BloodMarket.
//
// Post-deploy wiring:
//   a. registry.setMarket(market)               → links market, grants MINTER_ROLE
//   b. registry.grantRole(MINTER_ROLE, donation) → lets donation contract mint
//
// Note: Donor appreciation rewards and expiry bounties require YODA to be
// manually transferred to the BloodDonation and BloodRegistry contracts.
// The deployer must do this after deployment using their own YODA balance.
// ─────────────────────────────────────────────────────────────────────────────

const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

// keccak256("MINTER_ROLE") — matches BloodRegistry.sol constant
const MINTER_ROLE =
  "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";

// ── External YODA token issued by professor — not deployed by us ───────────
const EXTERNAL_YODA_ADDRESS = "0xbd27d0b7F9fedb5A2A2C3ceF5dC9c70f3CF64Af2";

const BASE_URI   = "https://api.bloodchain.example/blood/{id}.json";
const REWARD_WEI = 5n * 10n ** 2n;   // 5 YODA per altruistic donation (YODA has 2 decimals)

module.exports = buildModule("BloodBankModuleV2", (m) => {
  // ── 1. Reference external YodaToken (not deploying) ───────────────────────
  const yoda = m.contractAt("YodaToken", EXTERNAL_YODA_ADDRESS);

  // ── 2. BloodRegistry ──────────────────────────────────────────────────────
  const registry = m.contract("BloodRegistry", [BASE_URI, yoda]);

  // ── 3. BloodDonation ──────────────────────────────────────────────────────
  const donation = m.contract("BloodDonation", [registry, yoda, REWARD_WEI]);

  // ── 4. BloodMarket ────────────────────────────────────────────────────────
  const market = m.contract("BloodMarket", [yoda, registry]);

  // ── Post-deploy wiring ────────────────────────────────────────────────────

  // a) Link market → grants MINTER_ROLE to BloodMarket
  const setMarket = m.call(registry, "setMarket", [market], {
    id: "setMarket",
  });

  // b) Grant MINTER_ROLE to BloodDonation so it can mint to admin
  m.call(registry, "grantRole", [MINTER_ROLE, donation], {
    id: "grantMinterToDonation",
    after: [setMarket],
  });

  return { yoda, registry, donation, market };
});
