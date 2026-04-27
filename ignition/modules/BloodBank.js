// ─────────────────────────────────────────────────────────────────────────────
// Hardhat Ignition – BloodBank Deployment Module
//
// Deployment order and post-deploy wiring:
//   1. YodaToken        (ERC-20 payment token, zero initial supply)
//   2. BloodRegistry    (ERC-1155 blood unit tokens, needs yoda address)
//   3. BloodDonation    (handles altruistic donations, mints to admin)
//   4. BloodMarket      (P2P + platform marketplace)
//
// Post-deploy calls (all done atomically by Ignition):
//   a. registry.setMarket(market)          → links market, grants MINTER_ROLE
//   b. registry.grantRole(MINTER_ROLE, donation) → lets donation contract mint
//   c. yoda.mint(donation, 10 000 YODA)   → pre-fund donor appreciation rewards
//   d. yoda.mint(registry, 1 000 YODA)    → pre-fund expiry bounty payouts
//   e. yoda.mint(deployer, 100 000 YODA)  → admin tokens for marketplace / testing
// ─────────────────────────────────────────────────────────────────────────────

const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

// keccak256("MINTER_ROLE") — matches BloodRegistry.sol constant
const MINTER_ROLE =
  "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";

// Adjust these values to suit your deployment
const BASE_URI  = "https://api.bloodchain.example/blood/{id}.json";
const REWARD_WEI = 5n * 10n ** 18n;     // 5 YODA per altruistic donation

module.exports = buildModule("BloodBankModule", (m) => {
  // ── 1. YodaToken ──────────────────────────────────────────────────────────
  // initialSupply = 0  (we will mint via the admin calls below)
  const yoda = m.contract("YodaToken", [0n]);

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

  // c) Fund BloodDonation with YODA for donor appreciation payouts
  m.call(yoda, "mint", [donation, 10_000n * 10n ** 18n], {
    id: "fundDonationRewards",
  });

  // d) Fund BloodRegistry with YODA for expiry-bounty payouts
  m.call(yoda, "mint", [registry, 1_000n * 10n ** 18n], {
    id: "fundExpiryBounties",
  });

  // e) Mint a working balance to the deployer / admin
  m.call(yoda, "mint", [m.getAccount(0), 100_000n * 10n ** 18n], {
    id: "mintToDeployer",
  });

  return { yoda, registry, donation, market };
});
