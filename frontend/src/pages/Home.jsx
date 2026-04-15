import { Link } from "react-router-dom";
import { useWeb3 } from "../Web3Provider";

export default function Home() {
  const { account, connect } = useWeb3();

  return (
    <div className="home">
      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">
            Decentralized <span className="text-red">Blood</span> Marketplace
          </h1>
          <p className="hero-subtitle">
            Tokenized blood units on Ethereum. Transparent, trustless, and life-saving.
            Buy, sell, or donate blood — powered by blockchain.
          </p>
          {!account ? (
            <button className="btn btn-primary btn-lg" onClick={connect}>
              Connect Wallet to Get Started
            </button>
          ) : (
            <div className="hero-actions">
              <Link to="/marketplace" className="btn btn-primary btn-lg">Browse Marketplace</Link>
              <Link to="/donate" className="btn btn-outline btn-lg">Donate Blood</Link>
            </div>
          )}
        </div>
        <div className="hero-visual">
          <div className="hero-stats">
            <div className="stat-card">
              <span className="stat-icon">&#x1FA78;</span>
              <span className="stat-label">Blood Units</span>
              <span className="stat-desc">Tokenized as ERC-1155</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon">&#x1F4B0;</span>
              <span className="stat-label">YODA Token</span>
              <span className="stat-desc">ERC-20 Payments</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon">&#x1F91D;</span>
              <span className="stat-label">P2P + Donation</span>
              <span className="stat-desc">Two ways to contribute</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="how-it-works">
        <h2>How It Works</h2>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <h3>Register Blood</h3>
            <p>Donors register blood units with type, component, and expiry. Data is stored off-chain; a tamper-proof hash goes on-chain.</p>
          </div>
          <div className="step-card">
            <div className="step-number">2</div>
            <h3>List or Donate</h3>
            <p>Sell on the marketplace at your price (P2P) or donate altruistically — earn YODA appreciation tokens as thanks.</p>
          </div>
          <div className="step-card">
            <div className="step-number">3</div>
            <h3>Buy with YODA</h3>
            <p>Buyers browse, filter by blood type, and purchase using YODA tokens. Donated blood is available at a flat rate.</p>
          </div>
          <div className="step-card">
            <div className="step-number">4</div>
            <h3>On-Chain Proof</h3>
            <p>Every transaction is recorded on Ethereum. Ownership, provenance, and expiry are verifiable by anyone.</p>
          </div>
        </div>
      </section>

      {/* Two paths */}
      <section className="paths-section">
        <h2>Two Ways to Contribute</h2>
        <div className="paths-grid">
          <div className="path-card path-sell">
            <h3>Sell (P2P)</h3>
            <ul>
              <li>Set your own price</li>
              <li>You receive 95% of the sale</li>
              <li>5% platform fee to admin</li>
              <li>Direct wallet-to-wallet transfer</li>
            </ul>
            <Link to="/sell" className="btn btn-primary">Start Selling</Link>
          </div>
          <div className="path-card path-donate">
            <h3>Donate (Altruistic)</h3>
            <ul>
              <li>Blood goes to the platform pool</li>
              <li>Earn YODA appreciation reward</li>
              <li>Admin sells at affordable flat rate</li>
              <li>Making blood accessible for all</li>
            </ul>
            <Link to="/donate" className="btn btn-secondary">Donate Now</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
