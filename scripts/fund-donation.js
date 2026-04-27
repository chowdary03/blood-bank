/**
 * Funds the BloodDonation contract with YODA from the deployer wallet
 * so it can pay appreciation rewards to donors.
 *
 * Run AFTER deploy:sepolia and export:sepolia:
 *   npx hardhat run scripts/fund-donation.js --network sepolia
 *   npx hardhat run scripts/fund-donation.js --network localhost
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const EXTERNAL_YODA = "0xbd27d0b7F9fedb5A2A2C3ceF5dC9c70f3CF64Af2";

async function main() {
  const [deployer] = await ethers.getSigners();

  // Read deployed addresses
  const network = hre.network.name;
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const deployedPath = path.join(
    __dirname, "..", "ignition", "deployments",
    `chain-${chainId}`, "deployed_addresses.json"
  );

  if (!fs.existsSync(deployedPath)) {
    throw new Error(`No deployment found. Run npm run deploy:${network} first.`);
  }

  const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8"));
  const donationAddress = Object.entries(deployed)
    .find(([k]) => k.includes("BloodDonation"))?.[1];

  if (!donationAddress) throw new Error("BloodDonation not found in deployment.");

  const yoda = await ethers.getContractAt("YodaToken", EXTERNAL_YODA);
  const amount = ethers.parseUnits("100", 2); // 100 YODA (2 decimals) to fund rewards

  const bal = await yoda.balanceOf(deployer.address);
  console.log(`Deployer YODA balance: ${ethers.formatUnits(bal, 2)} YODA`);

  if (bal < amount) {
    throw new Error(`Insufficient YODA. Need 100, have ${ethers.formatUnits(bal, 2)}`);
  }

  const tx = await yoda.transfer(donationAddress, amount);
  await tx.wait();

  const newBal = await yoda.balanceOf(donationAddress);
  console.log(`✓ Transferred 100 YODA to BloodDonation (${donationAddress})`);
  console.log(`  BloodDonation YODA balance: ${ethers.formatUnits(newBal, 2)} YODA`);
  console.log(`  Each donor will receive 5 YODA as appreciation reward.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
