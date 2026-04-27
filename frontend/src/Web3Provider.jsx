import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
import { YODA_DECIMALS } from "./contracts";
import {
  ADDRESSES, YODA_ABI, REGISTRY_ABI, MARKET_ABI, DONATION_ABI,
} from "./contracts";

const Web3Ctx = createContext(null);
export const useWeb3 = () => useContext(Web3Ctx);

export default function Web3Provider({ children }) {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contracts, setContracts] = useState(null);
  const [yodaBalance, setYodaBalance] = useState("0");
  const [isAdmin, setIsAdmin] = useState(false);
  const [chainId, setChainId] = useState(null);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask to use this dApp.");
      return;
    }
    const p = new BrowserProvider(window.ethereum);
    const s = await p.getSigner();
    const addr = await s.getAddress();
    const network = await p.getNetwork();

    const yoda     = new Contract(ADDRESSES.YodaToken,     YODA_ABI,     s);
    const registry = new Contract(ADDRESSES.BloodRegistry, REGISTRY_ABI, s);
    const market   = new Contract(ADDRESSES.BloodMarket,   MARKET_ABI,   s);
    const donation = new Contract(ADDRESSES.BloodDonation, DONATION_ABI, s);

    setProvider(p);
    setSigner(s);
    setAccount(addr);
    setChainId(Number(network.chainId));
    setContracts({ yoda, registry, market, donation });

    // Check admin
    try {
      const owner = await market.owner();
      setIsAdmin(owner.toLowerCase() === addr.toLowerCase());
    } catch { setIsAdmin(false); }

    // YODA balance
    try {
      const bal = await yoda.balanceOf(addr);
      setYodaBalance(formatUnits(bal, YODA_DECIMALS));
    } catch { setYodaBalance("0"); }
  }, []);

  // Refresh YODA balance
  const refreshBalance = useCallback(async () => {
    if (!contracts || !account) return;
    try {
      const bal = await contracts.yoda.balanceOf(account);
      setYodaBalance(formatUnits(bal, YODA_DECIMALS));
    } catch {}
  }, [contracts, account]);

  // Listen for account / chain changes
  useEffect(() => {
    if (!window.ethereum) return;
    const onAccounts = () => connect();
    const onChain = () => window.location.reload();
    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged", onChain);
    return () => {
      window.ethereum.removeListener("accountsChanged", onAccounts);
      window.ethereum.removeListener("chainChanged", onChain);
    };
  }, [connect]);

  return (
    <Web3Ctx.Provider value={{
      account, provider, signer, contracts,
      yodaBalance, isAdmin, chainId,
      connect, refreshBalance,
      formatEther: (v) => formatUnits(v, YODA_DECIMALS),
      parseEther:  (v) => parseUnits(String(v), YODA_DECIMALS),
    }}>
      {children}
    </Web3Ctx.Provider>
  );
}
