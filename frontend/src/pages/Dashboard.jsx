import { useState, useEffect } from "react";
import { formatEther } from "ethers";
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
  const [tab, setTab] = useState("tokens"); // tokens | listings

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
          tokens.push({
            tokenId: i,
            balance: bal,
            expired,
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
                {t.expired && t.bloodInfo.status !== 4 && (
                  <TxButton
                    onClick={() => handleFlagExpired(t.tokenId)}
                    className="btn btn-danger btn-full"
                  >
                    Flag as Expired
                  </TxButton>
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
              </BloodCard>
            ))}
          </div>
        )
      )}
    </div>
  );
}
