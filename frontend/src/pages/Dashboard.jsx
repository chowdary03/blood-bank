import { useState, useEffect } from "react";
import { formatEther, parseEther } from "ethers";
import toast from "react-hot-toast";
import { useWeb3 } from "../Web3Provider";
import BloodCard from "../components/BloodCard";
import TxButton from "../components/TxButton";
import { STATUSES } from "../contracts";

export default function Dashboard() {
  const { contracts, account, isAdmin, refreshBalance } = useWeb3();
  const [myTokens, setMyTokens] = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("tokens");

  // Inline list-for-sale state: tokenId → price string
  const [listingPrice, setListingPrice] = useState({}); // { [tokenId]: "10" }
  const [listingAmount, setListingAmount] = useState({}); // { [tokenId]: "1" }
  const [listingOpen, setListingOpen] = useState({}); // { [tokenId]: true/false }

  useEffect(() => {
    if (contracts && account) loadDashboard();
  }, [contracts, account]);

  async function loadDashboard() {
    setLoading(true);
    try {
      const totalTokens = Number(await contracts.registry.nextTokenId());
      const totalListings = Number(await contracts.market.nextListingId());

      // Find tokens I own
      const tokens = [];
      for (let i = 0; i < totalTokens; i++) {
        const bal = Number(await contracts.registry.balanceOf(account, i));
        if (bal > 0) {
          const info = await contracts.registry.bloodInfo(i);
          const expired = await contracts.registry.isExpired(i);
          // If user holds the token but chain says "Sold" (status 2), that means
          // they just bought it from the marketplace — override to "Available" (0).
          const onChainStatus = Number(info.status);
          const displayStatus = (onChainStatus === 2) ? 0 : onChainStatus;
          tokens.push({
            tokenId: i,
            balance: bal,
            expired,
            bloodInfo: {
              bloodGroup: Number(info.bloodGroup),
              rhPositive: info.rhPositive,
              component: Number(info.component),
              status: displayStatus,
              collectionTime: info.collectionTime,
              expiryTime: info.expiryTime,
              donor: info.donor,
            },
          });
        }
      }
      // Sort: expired last
      tokens.sort((a, b) => {
        if (a.expired !== b.expired) return a.expired ? 1 : -1;
        return Number(a.bloodInfo.expiryTime) - Number(b.bloodInfo.expiryTime);
      });
      setMyTokens(tokens);

      // Find my listings
      const listings = [];
      for (let i = 0; i < totalListings; i++) {
        const l = await contracts.market.listings(i);
        if (l.seller.toLowerCase() === account.toLowerCase() && l.active) {
          const info = await contracts.registry.bloodInfo(l.tokenId);
          listings.push({
            listingId: Number(l.id),
            tokenId: Number(l.tokenId),
            amount: Number(l.amount),
            pricePerUnit: formatEther(l.pricePerUnit),
            bloodInfo: {
              bloodGroup: Number(info.bloodGroup),
              rhPositive: info.rhPositive,
              component: Number(info.component),
              status: Number(info.status),
              collectionTime: info.collectionTime,
              expiryTime: info.expiryTime,
              donor: info.donor,
            },
          });
        }
      }
      setMyListings(listings);
    } catch (err) {
      toast.error("Failed to load dashboard");
    }
    setLoading(false);
  }

  async function handleFlagExpired(tokenId) {
    toast.loading("Flagging expired unit...", { id: "flag" });
    const tx = await contracts.registry.updateStatus(tokenId, 4); // 4 = Expired
    await tx.wait();
    toast.success("Unit flagged as expired", { id: "flag" });
    await loadDashboard();
  }

  async function handleListToken(tokenId, balance) {
    const price = listingPrice[tokenId] || "1";
    const amt   = listingAmount[tokenId] || "1";

    if (Number(amt) < 1 || Number(amt) > balance) {
      toast.error(`Amount must be between 1 and ${balance}`);
      return;
    }
    if (Number(price) <= 0) {
      toast.error("Price must be greater than 0");
      return;
    }

    // Approve market to move tokens if not already approved
    const approved = await contracts.registry.isApprovedForAll(account, contracts.market.target);
    if (!approved) {
      toast.loading("Approving marketplace...", { id: "approval" });
      const approveTx = await contracts.registry.setApprovalForAll(contracts.market.target, true);
      await approveTx.wait();
      toast.success("Approved!", { id: "approval" });
    }

    const priceWei = parseEther(price);
    toast.loading("Creating listing...", { id: `list-${tokenId}` });
    const tx = await contracts.market.createListing(BigInt(tokenId), BigInt(amt), priceWei);
    await tx.wait();
    toast.success(`Token #${tokenId} listed for ${price} YODA/unit`, { id: `list-${tokenId}` });

    setListingOpen((s) => ({ ...s, [tokenId]: false }));
    await refreshBalance();
    await loadDashboard();
  }

  async function handleCancelListing(listingId) {
    toast.loading(`Cancelling listing #${listingId}...`, { id: `cancel-${listingId}` });
    const tx = await contracts.market.cancelListing(BigInt(listingId));
    await tx.wait();
    toast.success(`Listing #${listingId} cancelled. Tokens returned to your wallet.`, { id: `cancel-${listingId}` });
    await loadDashboard();
  }

  if (!account) {
    return (
      <div className="page-container">
        <div className="connect-prompt">
          <h2>Connect your wallet to view your dashboard</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>My Dashboard</h1>
        <p>
          {isAdmin && <span className="admin-badge">ADMIN</span>}
          Manage your blood tokens and active listings.
        </p>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === "tokens" ? "active" : ""}`} onClick={() => setTab("tokens")}>
          My Tokens ({myTokens.length})
        </button>
        <button className={`tab ${tab === "listings" ? "active" : ""}`} onClick={() => setTab("listings")}>
          My Listings ({myListings.length})
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading your data...</div>
      ) : tab === "tokens" ? (
        /* Tokens tab */
        myTokens.length === 0 ? (
          <div className="empty-state">
            <p>You don't own any blood tokens yet.</p>
          </div>
        ) : (
          <div className="cards-grid">
            {myTokens.map((t) => (
              <BloodCard key={t.tokenId} info={t.bloodInfo} highlight={t.expired}>
                <div className="token-details">
                  <div className="info-row">
                    <span className="info-label">Token ID</span>
                    <span className="info-value">#{t.tokenId}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Balance</span>
                    <span className="info-value">{t.balance} unit{t.balance > 1 ? "s" : ""}</span>
                  </div>
                </div>

                {/* Flag expired */}
                {t.expired && t.bloodInfo.status !== 4 && (
                  <TxButton
                    onClick={() => handleFlagExpired(t.tokenId)}
                    className="btn btn-danger btn-full"
                  >
                    Flag as Expired
                  </TxButton>
                )}

                {/* List for sale */}
                {!t.expired && (
                  <>
                    {listingOpen[t.tokenId] ? (
                      <div className="inline-list-form">
                        <div className="form-row">
                          <label>Units to list</label>
                          <input
                            type="number" min="1" max={t.balance}
                            value={listingAmount[t.tokenId] || "1"}
                            onChange={(e) => setListingAmount((s) => ({ ...s, [t.tokenId]: e.target.value }))}
                          />
                        </div>
                        <div className="form-row">
                          <label>Price / unit (YODA)</label>
                          <input
                            type="number" min="0.001" step="0.1"
                            value={listingPrice[t.tokenId] || "1"}
                            onChange={(e) => setListingPrice((s) => ({ ...s, [t.tokenId]: e.target.value }))}
                          />
                        </div>
                        <div className="btn-row">
                          <TxButton
                            onClick={() => handleListToken(t.tokenId, t.balance)}
                            className="btn btn-primary btn-sm"
                          >
                            Confirm Listing
                          </TxButton>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => setListingOpen((s) => ({ ...s, [t.tokenId]: false }))}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="btn btn-primary btn-full"
                        onClick={() => setListingOpen((s) => ({ ...s, [t.tokenId]: true }))}
                      >
                        List for Sale
                      </button>
                    )}

                  </>
                )}
              </BloodCard>
            ))}
          </div>
        )
      ) : (
        /* Listings tab */
        myListings.length === 0 ? (
          <div className="empty-state">
            <p>You have no active listings.</p>
          </div>
        ) : (
          <div className="cards-grid">
            {myListings.map((l) => (
              <BloodCard key={l.listingId} info={l.bloodInfo}>
                <div className="listing-details">
                  <div className="info-row">
                    <span className="info-label">Listing ID</span>
                    <span className="info-value">#{l.listingId}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Price</span>
                    <span className="info-value">{l.pricePerUnit} YODA/unit</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Remaining</span>
                    <span className="info-value">{l.amount} units</span>
                  </div>
                </div>
                <TxButton
                  onClick={() => handleCancelListing(l.listingId)}
                  className="btn btn-danger btn-full"
                >
                  Cancel Listing (reclaim tokens)
                </TxButton>
              </BloodCard>
            ))}
          </div>
        )
      )}
    </div>
  );
}
