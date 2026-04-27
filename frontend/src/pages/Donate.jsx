import { useState, useEffect } from "react";
import { keccak256, toUtf8Bytes, formatUnits } from "ethers";
import toast from "react-hot-toast";
import { useWeb3 } from "../Web3Provider";
import TxButton from "../components/TxButton";
import { BLOOD_GROUPS, COMPONENTS } from "../contracts";

export default function Donate() {
  const { contracts, account, refreshBalance } = useWeb3();
  const [reward, setReward] = useState("0");

  // Form
  const [bloodGroup, setBloodGroup] = useState("0");
  const [rhPositive, setRhPositive] = useState(true);
  const [component, setComponent] = useState("0");
  const [volumeMl, setVolumeMl] = useState("450");
  const [storageDetails, setStorageDetails] = useState("");
  const [expiryDays, setExpiryDays] = useState("30");
  const [amount, setAmount] = useState("1");

  // Success state
  const [donated, setDonated] = useState(null);

  useEffect(() => {
    if (contracts) loadReward();
  }, [contracts]);

  async function loadReward() {
    try {
      const r = await contracts.donation.appreciationReward();
      setReward(formatUnits(r, 2));
    } catch {}
  }

  async function handleDonate() {
    const expiryTime = Math.floor(Date.now() / 1000) + Number(expiryDays) * 86400;

    const metadata = JSON.stringify({
      volumeMl: Number(volumeMl),
      storageDetails,
      donorWallet: account,
      donationType: "altruistic",
      donatedAt: new Date().toISOString(),
    });

    const metadataHash = keccak256(toUtf8Bytes(metadata));

    toast.loading("Processing your donation...", { id: "donate" });

    const tx = await contracts.donation.donate(
      Number(bloodGroup),
      rhPositive,
      Number(component),
      BigInt(expiryTime),
      metadataHash,
      BigInt(amount),
    );

    const receipt = await tx.wait();

    // Parse Donated event
    let tokenId = null;
    let rewardPaid = "0";
    for (const log of receipt.logs) {
      try {
        const parsed = contracts.donation.interface.parseLog(log);
        if (parsed?.name === "Donated") {
          tokenId = Number(parsed.args.tokenId);
          rewardPaid = formatUnits(parsed.args.rewardPaid, 2);
          break;
        }
      } catch {}
    }

    // Save off-chain metadata
    const stored = JSON.parse(localStorage.getItem("bloodMetadata") || "{}");
    if (tokenId !== null) {
      stored[tokenId] = JSON.parse(metadata);
      localStorage.setItem("bloodMetadata", JSON.stringify(stored));
    }

    toast.success("Thank you for your donation!", { id: "donate" });
    setDonated({ tokenId, rewardPaid });
    await refreshBalance();
  }

  if (!account) {
    return (
      <div className="page-container">
        <div className="connect-prompt">
          <h2>Connect your wallet to donate blood</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Donate Blood</h1>
        <p>Give the gift of life. Your donation helps make blood accessible at affordable prices.</p>
      </div>

      <div className="reward-banner">
        <span className="reward-icon">&#x1F381;</span>
        <div>
          <strong>Appreciation Reward</strong>
          <p>You will receive <strong>{reward} YODA</strong> tokens as a thank you for each donation.</p>
        </div>
      </div>

      {!donated ? (
        <div className="form-card">
          <h2>Donation Details</h2>
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
                placeholder="e.g. Refrigerated at blood bank..." />
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

          <div className="donate-info">
            <p>Your blood tokens will be minted to the platform admin, who will list them at an affordable flat rate for buyers in need.</p>
          </div>

          <TxButton onClick={handleDonate} className="btn btn-secondary btn-lg btn-full">
            Donate Blood
          </TxButton>
        </div>
      ) : (
        <div className="form-card success-card">
          <div className="success-icon">&#x2764;&#xFE0F;</div>
          <h2>Thank You for Your Donation!</h2>
          <div className="success-details">
            <p><strong>Token ID:</strong> #{donated.tokenId}</p>
            <p><strong>Reward Received:</strong> {donated.rewardPaid} YODA</p>
          </div>
          <p className="success-message">
            Your blood unit has been registered on the blockchain. The platform will list it at an affordable price so someone in need can access it.
          </p>
          <button className="btn btn-secondary btn-lg" onClick={() => setDonated(null)}>
            Donate Again
          </button>
        </div>
      )}
    </div>
  );
}
