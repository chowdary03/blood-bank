# BloodChain (blood-bank)

BloodChain is a decentralized blood donation and marketplace system built with:

- Solidity smart contracts (Hardhat)
- React + Vite frontend
- ERC-20 (YODA) payments and ERC-1155 blood units

## Project Structure

- `contracts/` - Solidity smart contracts
- `ignition/modules/` - Hardhat Ignition deployment module
- `scripts/` - helper scripts (funding, minting, export addresses)
- `frontend/` - React app

## Prerequisites

- Node.js 18+ (recommended: 20+)
- npm 9+
- MetaMask browser extension
- A funded wallet for Sepolia (if deploying/testnet usage)

## 1) Install Dependencies

From the project root:

```bash
npm install
```

Install frontend dependencies:

```bash
cd frontend
npm install
cd ..
```

## 2) Configure Environment

Create a `.env` file in the project root (for Hardhat):

```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY
```

Notes:

- Never commit `.env`.
- Use a dedicated dev wallet, not your primary wallet.

## 3) Compile Smart Contracts

```bash
npx hardhat compile
```

## 4) Run Local Blockchain (Option A)

Start a local Hardhat node:

```bash
npx hardhat node
```

In another terminal, deploy contracts locally:

```bash
npx hardhat ignition deploy ./ignition/modules/BloodBank.js --network localhost
```

## 5) Deploy to Sepolia (Option B)

```bash
npx hardhat ignition deploy ./ignition/modules/BloodBank.js --network sepolia
```

Optional: export deployed addresses for frontend usage:

```bash
node scripts/export-addresses.js
```

## 6) Seed / Test Contract Data (Optional)

Run helper scripts (network can be changed):

```bash
npx hardhat run scripts/fund-donation.js --network sepolia
npx hardhat run scripts/mint-test-yoda.js --network sepolia
```

## 7) Run the Frontend

```bash
cd frontend
npm run dev
```

Open the URL shown in terminal (usually http://localhost:5173).

## 8) Point Frontend to Correct Contracts

Update addresses/ABIs in:

- `frontend/src/contracts.js`

Make sure addresses match your deployed network.

## Useful Commands

From root:

```bash
npx hardhat test
npx hardhat clean
npx hardhat compile
```

From frontend:

```bash
npm run dev
npm run build
npm run preview
```

## Troubleshooting

- If frontend transactions fail, verify:
	- MetaMask is on the same network as deployed contracts
	- `frontend/src/contracts.js` has correct addresses
	- wallet has enough ETH (gas) and YODA (if needed)
- If deployment fails on Sepolia, verify `.env` values and RPC connectivity.
- If contract recompilation behaves oddly, run `npx hardhat clean && npx hardhat compile`.

## Quick Start (Local)

Run these in separate terminals:

1. `npx hardhat node`
2. `npx hardhat ignition deploy ./ignition/modules/BloodBank.js --network localhost`
3. `cd frontend && npm run dev`

Then connect MetaMask to localhost and interact with the app.
