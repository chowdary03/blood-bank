import { useState } from "react";
import { keccak256, toUtf8Bytes } from "ethers";
import toast from "react-hot-toast";
import { useWeb3 } from "../Web3Provider";
import TxButton from "../components/TxButton";
import { BLOOD_GROUPS, COMPONENTS } from "../contracts";

export default function Sell() {
  const { contracts, account, refreshBalance } = useWeb3();
  const [step, setStep] = useState(1); // 1 = register, 2 = list

  // Registration form
  const [bloodGroup, setBloodGroup] = useState("0");
  const [rhPositive, setRhPositive] = useState(true);
  const [component, setComponent] = useState("0");
  const [volumeMl, setVolumeMl] = useState("450");
  const [storageDetails, setStorageDetails] = useState("");
  const [priority, setPriority] = useState("0");
  const [expiryDays, setExpiryDays] = useState("30");
  const [amount, setAmount] = useState("1");

  // Result after registration
  const [tokenId, setTokenId] = useState(null);

  // Listing form
  const [pricePerUnit, setPricePerUnit] = useState("1");

  async function handleRegister() {
    const expiryTime = Math.floor(Date.now() / 1000) + Number(expiryDays) * 86400;

    // Build off-chain metadata JSON
    const metadata = JSON.stringify({
      volumeMl: Number(volumeMl),
      storageDetails,
      priority: Number(priority),
      registeredBy: account,
      registeredAt: new Date().toISOString(),
    });

    // Hash it for on-chain tamper-proof reference
    const metadataHash = keccak256(toUtf8Bytes(metadata));

    toast.loading("Registering blood unit on-chain...", { id: "register" });

    const tx = await contracts.registry.registerUnit(
      account,                    // recipient = self (P2P path)
      Number(bloodGroup),
      rhPositive,
      Number(component),
      BigInt(expiryTime),
      metadataHash,
      BigInt(amount),
      account,                    // actualDonor = the P2P seller themselves
    );

    const receipt = await tx.wait();

    // Extract tokenId from event logs
    const event = receipt.logs.find(log => {
      try {
        return contracts.registry.interface.parseLog(log)?.name === "UnitRegistered";
      } catch { return false; }
    });

    let newTokenId = null;
    if (event) {
      const parsed = contracts.registry.interface.parseLog(event);
      newTokenId = Number(parsed.args.tokenId);
    } else {
      // Fallback: tokenId = nextTokenId - 1
      const next = await contracts.registry.nextTokenId();
      newTokenId = Number(next) - 1;
    }

    setTokenId(newTokenId);
    toast.success(`Blood unit registered! Token ID: ${newTokenId}`, { id: "register" });

    // Save metadata to localStorage as simple off-chain DB
    const stored = JSON.parse(localStorage.getItem("bloodMetadata") || "{}");
    stored[newTokenId] = JSON.parse(metadata);
    localStorage.setItem("bloodMetadata", JSON.stringify(stored));

    setStep(2);
  }

  async function handleList() {
    // Ensure approval
    const approved = await contracts.registry.isApprovedForAll(account, contracts.market.target);
    if (!approved) {
      toast.loading("Approving marketplace...", { id: "approval" });
      const approveTx = await contracts.registry.setApprovalForAll(contracts.market.target, true);
      await approveTx.wait();
      toast.success("Marketplace approved!", { id: "approval" });
    }

    const priceWei = BigInt(Math.floor(Number(pricePerUnit) * 1e18));

    toast.loading("Creating listing...", { id: "list" });
    const tx = await contracts.market.createListing(
      BigInt(tokenId),
      BigInt(amount),
      priceWei,
    );
    await tx.wait();
    toast.success("Listed on marketplace!", { id: "list" });
    await refreshBalance();

    // Reset
    setStep(1);
    setTokenId(null);
  }

  if (!account) {
    return (
      <div className="page-container">
        <div className="connect-prompt">
          <h2>Connect your wallet to sell blood units</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Sell Blood (P2P)</h1>
        <p>Register your blood unit, then list it on the marketplace at your price.</p>
      </div>

      {/* Progress indicator */}
      <div className="steps-indicator">
        <div className={`step-dot ${step >= 1 ? "active" : ""}`}>
          <span>1</span>
          <label>Register Unit</label>
        </div>
        <div className="step-line" />
        <div className={`step-dot ${step >= 2 ? "active" : ""}`}>
          <span>2</span>
          <label>List for Sale</label>
        </div>
      </div>

      {step === 1 && (
        <div className="form-card">
          <h2>Register Blood Unit</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>Blood Group</label>
              <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
                {BLOOD_GROUPS.map((g, i) => (
                  <option key={i} value={i}>{g}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Rh Factor</label>
              <select value={rhPositive.toString()} onChange={(e) => setRhPositive(e.target.value === "true")}>
                <option value="true">Rh+ (Positive)</option>
                <option value="false">Rh- (Negative)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Component</label>
              <select value={component} onChange={(e) => setComponent(e.target.value)}>
                {COMPONENTS.map((c, i) => (
                  <option key={i} value={i}>{c}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Volume (mL)</label>
              <input type="number" value={volumeMl} onChange={(e) => setVolumeMl(e.target.value)} min="1" />
            </div>

            <div className="form-group">
              <label>Storage Details</label>
              <input type="text" value={storageDetails} onChange={(e) => setStorageDetails(e.target.value)}
                placeholder="e.g. Cold storage, Room temp..." />
            </div>

            <div className="form-group">
              <label>Priority (0-255)</label>
              <input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} min="0" max="255" />
            </div>

            <div className="form-group">
              <label>Expires In (days)</label>
              <input type="number" value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)} min="1" />
            </div>

            <div className="form-group">
              <label>Number of Units</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min="1" />
            </div>
          </div>

          <TxButton onClick={handleRegister} className="btn btn-primary btn-lg btn-full">
            Register Blood Unit
          </TxButton>
        </div>
      )}

      {step === 2 && tokenId !== null && (
        <div className="form-card">
          <div className="success-banner">
            Blood unit registered successfully! Token ID: <strong>#{tokenId}</strong>
          </div>
          <h2>List on Marketplace</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>Price per Unit (YODA)</label>
              <input type="number" value={pricePerUnit} onChange={(e) => setPricePerUnit(e.target.value)}
                min="0.001" step="0.1" />
            </div>
          </div>
          <p className="info-text">
            A 5% platform fee will be deducted from each sale.
            You will receive {(Number(pricePerUnit) * 0.95).toFixed(4)} YODA per unit.
          </p>

          <TxButton onClick={handleList} className="btn btn-primary btn-lg btn-full">
            List for Sale
          </TxButton>

          <button className="btn btn-outline btn-full" onClick={() => { setStep(1); setTokenId(null); }}
            style={{ marginTop: "0.5rem" }}>
            Skip — Don't list now
          </button>
        </div>
      )}
    </div>
  );
}
