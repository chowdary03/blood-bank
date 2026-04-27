/**
 * Mints 500 YODA to Account #1 (the second hardhat test account).
 * Run with:  npx hardhat run scripts/mint-test-yoda.js --network localhost
 */

const { ethers } = require("hardhat");

async function main() {
  const [admin, account1] = await ethers.getSigners();

  const YODA_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const yoda = await ethers.getContractAt("YodaToken", YODA_ADDRESS);

  const amount = ethers.parseEther("500");
  const tx = await yoda.mint(account1.address, amount);
  await tx.wait();

  const bal = await yoda.balanceOf(account1.address);
  console.log(`✓ Minted 500 YODA to ${account1.address}`);
  console.log(`  New balance: ${ethers.formatEther(bal)} YODA`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
