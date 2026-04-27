// ═══════════════════════════════════════════════════════════════════════════
// CONTRACT ADDRESSES — Update these after deploying to your network
// ═══════════════════════════════════════════════════════════════════════════

export const ADDRESSES = {
  YodaToken:     "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  BloodRegistry: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  BloodMarket:   "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
  BloodDonation: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
};

// ═══════════════════════════════════════════════════════════════════════════
// ABIs — Only the functions/events the frontend actually calls
// ═══════════════════════════════════════════════════════════════════════════

export const YODA_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
];

export const REGISTRY_ABI = [
  "function nextTokenId() view returns (uint256)",
  "function bloodInfo(uint256) view returns (uint8 bloodGroup, bool rhPositive, uint8 component, uint8 status, uint64 collectionTime, uint64 expiryTime, address donor, bytes32 metadataHash)",
  "function balanceOf(address, uint256) view returns (uint256)",
  "function isExpired(uint256) view returns (bool)",
  "function setApprovalForAll(address operator, bool approved)",
  "function isApprovedForAll(address account, address operator) view returns (bool)",
  "function registerUnit(address recipient, uint8 bloodGroup, bool rhPositive, uint8 component, uint64 expiryTime, bytes32 metadataHash, uint256 amount, address actualDonor) returns (uint256)",
  "function updateStatus(uint256 tokenId, uint8 newStatus)",
  "function market() view returns (address)",
  "event UnitRegistered(uint256 indexed tokenId, address indexed donor, address indexed recipient, bytes32 metadataHash)",
  "event StatusUpdated(uint256 indexed tokenId, uint8 current)",
];

export const MARKET_ABI = [
  "function nextListingId() view returns (uint256)",
  "function listings(uint256) view returns (uint256 id, address seller, uint256 tokenId, uint256 amount, uint256 pricePerUnit, bool active)",
  "function createListing(uint256 tokenId, uint256 amount, uint256 pricePerUnit)",
  "function cancelListing(uint256 listingId)",
  "function buy(uint256 listingId, uint256 amount)",
  "function owner() view returns (address)",
  "function P2P_FEE_BPS() view returns (uint256)",
  "event ListingCreated(uint256 indexed id, address indexed seller, uint256 indexed tokenId, uint256 amount, uint256 pricePerUnit)",
  "event ListingFilled(uint256 indexed id, address indexed buyer, uint256 amount, uint256 totalPaid)",
  "event ListingCancelled(uint256 indexed id, address indexed seller)",
];

export const DONATION_ABI = [
  "function appreciationReward() view returns (uint256)",
  "function donate(uint8 bloodGroup, bool rhPositive, uint8 component, uint64 expiryTime, bytes32 metadataHash, uint256 amount) returns (uint256)",
  "function owner() view returns (address)",
  "event Donated(uint256 indexed tokenId, address indexed donor, address indexed mintedTo, uint256 amount, uint256 rewardPaid)",
];

// ═══════════════════════════════════════════════════════════════════════════
// ENUMS — mirrors Solidity enums for display
// ═══════════════════════════════════════════════════════════════════════════

export const BLOOD_GROUPS = ["A", "B", "AB", "O"];
export const RH_LABELS = { true: "Rh+", false: "Rh−" };
export const COMPONENTS = ["Whole Blood", "PRBC", "Platelets", "Plasma"];
export const STATUSES = ["Available", "Reserved", "Sold", "Transfused", "Expired", "Discarded"];
