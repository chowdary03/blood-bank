import { Link, useLocation } from "react-router-dom";
import { useWeb3 } from "../Web3Provider";

const NAV_LINKS = [
  { to: "/",           label: "Home" },
  { to: "/marketplace", label: "Marketplace" },
  { to: "/sell",        label: "Sell" },
  { to: "/donate",      label: "Donate" },
  { to: "/dashboard",   label: "Dashboard" },
];

export default function Navbar() {
  const { account, yodaBalance, connect } = useWeb3();
  const { pathname } = useLocation();

  return (
    <nav className="navbar">
      <Link to="/" className="nav-brand">
        <span className="brand-icon">&#x1FA78;</span>
        <span>BloodChain</span>
      </Link>

      <div className="nav-links">
        {NAV_LINKS.map(({ to, label }) => (
          <Link key={to} to={to} className={`nav-link ${pathname === to ? "active" : ""}`}>
            {label}
          </Link>
        ))}
      </div>

      <div className="nav-wallet">
        {account ? (
          <>
            <span className="yoda-balance">{Number(yodaBalance).toFixed(2)} YODA</span>
            <span className="wallet-address">
              {account.slice(0, 6)}...{account.slice(-4)}
            </span>
          </>
        ) : (
          <button className="btn btn-primary" onClick={connect}>
            Connect Wallet
          </button>
        )}
      </div>
    </nav>
  );
}
