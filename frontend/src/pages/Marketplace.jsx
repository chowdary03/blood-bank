import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useWeb3 } from "../Web3Provider";
import BloodCard from "../components/BloodCard";
import TxButton from "../components/TxButton";
import { BLOOD_GROUPS, COMPONENTS } from "../contracts";

export default function Marketplace() {
  const { contracts, account, refreshBalance, parseEther, formatEther } = useWeb3();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterGroup, setFilterGroup] = useState("all");
  const [filterComponent, setFilterComponent] = useState("all");
  const [sortBy, setSortBy] = useState("expiry"); // expiry | price

  // Buy modal
  const [buyModal, setBuyModal] = useState(null); // listing object or null
  const [buyAmount, setBuyAmount] = useState("1");

  useEffect(() => {
    if (contracts) loadListings();
  }, [contracts]);

  async function loadListings() {
    setLoading(true);
    try {
      const total = Number(await contracts.market.nextListingId());
      const items = [];

      for (let i = 0; i < total; i++) {
        const l = await contracts.market.listings(i);
        if (!l.active) continue;

        const info = await contracts.registry.bloodInfo(l.tokenId);
        const expired = await contracts.registry.isExpired(l.tokenId);
        if (expired) continue;

        items.push({
          listingId: Number(l.id),
          seller: l.seller,
          tokenId: Number(l.tokenId),
          amount: Number(l.amount),
          pricePerUnit: l.pricePerUnit,
          priceDisplay: formatEther(l.pricePerUnit),
          bloodInfo: {
            bloodGroup: Number(info.bloodGroup),
            rhPositive: info.rhPositive,
            component: Number(info.component),
            // Token is actively listed — always show as Available regardless of on-chain status
            status: 0,
            collectionTime: info.collectionTime,
            expiryTime: info.expiryTime,
            donor: info.donor,
          },
        });
      }
      setListings(items);
    } catch (err) {
      toast.error("Failed to load listings");
    }
    setLoading(false);
  }

  // Filter & sort
  const filtered = listings
    .filter((l) => filterGroup === "all" || l.bloodInfo.bloodGroup === Number(filterGroup))
    .filter((l) => filterComponent === "all" || l.bloodInfo.component === Number(filterComponent))
    .sort((a, b) => {
      if (sortBy === "expiry") return Number(a.bloodInfo.expiryTime) - Number(b.bloodInfo.expiryTime);
      if (sortBy === "price") return Number(a.pricePerUnit) - Number(b.pricePerUnit);
      return 0;
    });

  async function handleBuy() {
    if (!buyModal) return;
    const amt = parseInt(buyAmount);
    if (isNaN(amt) || amt <= 0 || amt > buyModal.amount) {
      toast.error("Invalid amount");
      return;
    }

    const totalCost = buyModal.pricePerUnit * BigInt(amt);

    // Check allowance
    const allowance = await contracts.yoda.allowance(account, contracts.market.target);
    if (allowance < totalCost) {
      toast.loading("Approving YODA spend...", { id: "approve" });
      const approveTx = await contracts.yoda.approve(contracts.market.target, totalCost);
      await approveTx.wait();
      toast.success("Approved!", { id: "approve" });
    }

    toast.loading("Processing purchase...", { id: "buy" });
    const tx = await contracts.market.buy(buyModal.listingId, amt);
    await tx.wait();
    toast.success("Purchase successful! Blood unit is now yours.", { id: "buy" });

    setBuyModal(null);
    setBuyAmount("1");
    await refreshBalance();
    await loadListings();
  }

  if (!account) {
    return (
      <div className="page-container">
        <div className="connect-prompt">
          <h2>Connect your wallet to browse the marketplace</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Blood Marketplace</h1>
        <p>Browse available blood units. Sorted by expiry (soonest first) by default.</p>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <label>Blood Group</label>
          <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}>
            <option value="all">All Groups</option>
            {BLOOD_GROUPS.map((g, i) => (
              <option key={i} value={i}>{g}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Component</label>
          <select value={filterComponent} onChange={(e) => setFilterComponent(e.target.value)}>
            <option value="all">All Components</option>
            {COMPONENTS.map((c, i) => (
              <option key={i} value={i}>{c}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Sort By</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="expiry">Expiry (Soonest)</option>
            <option value="price">Price (Lowest)</option>
          </select>
        </div>
        <button className="btn btn-outline btn-sm" onClick={loadListings}>Refresh</button>
      </div>

      {/* Listings grid */}
      {loading ? (
        <div className="loading">Loading listings...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>No listings match your filters.</p>
        </div>
      ) : (
        <div className="cards-grid">
          {filtered.map((l) => (
            <BloodCard key={l.listingId} info={l.bloodInfo}>
              <div className="listing-price">
                <span className="price-label">Price</span>
                <span className="price-value">{l.priceDisplay} YODA / unit</span>
              </div>
              <div className="listing-amount">
                <span>{l.amount} unit{l.amount > 1 ? "s" : ""} available</span>
              </div>
              <button
                className="btn btn-primary btn-full"
                onClick={() => { setBuyModal(l); setBuyAmount("1"); }}
                disabled={l.seller.toLowerCase() === account.toLowerCase()}
              >
                {l.seller.toLowerCase() === account.toLowerCase() ? "Your Listing" : "Buy Now"}
              </button>
            </BloodCard>
          ))}
        </div>
      )}

      {/* Buy Modal */}
      {buyModal && (
        <div className="modal-overlay" onClick={() => setBuyModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Purchase Blood Unit</h2>
            <div className="modal-info">
              <p><strong>Blood Type:</strong> {BLOOD_GROUPS[buyModal.bloodInfo.bloodGroup]} {buyModal.bloodInfo.rhPositive ? "Rh+" : "Rh-"}</p>
              <p><strong>Price:</strong> {buyModal.priceDisplay} YODA per unit</p>
              <p><strong>Available:</strong> {buyModal.amount} units</p>
            </div>
            <div className="form-group">
              <label>Quantity</label>
              <input
                type="number"
                min="1"
                max={buyModal.amount}
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
              />
            </div>
            <p className="total-cost">
              Total: <strong>{(Number(buyModal.priceDisplay) * Number(buyAmount || 0)).toFixed(4)} YODA</strong>
            </p>
            <div className="modal-actions">
              <TxButton onClick={handleBuy}>Confirm Purchase</TxButton>
              <button className="btn btn-outline" onClick={() => setBuyModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
