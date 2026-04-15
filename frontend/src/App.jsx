import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Web3Provider from "./Web3Provider";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Marketplace from "./pages/Marketplace";
import Sell from "./pages/Sell";
import Donate from "./pages/Donate";
import Dashboard from "./pages/Dashboard";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <Web3Provider>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/sell" element={<Sell />} />
          <Route path="/donate" element={<Donate />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#1a1a24",
              color: "#e4e4e7",
              border: "1px solid #2a2a3a",
            },
          }}
        />
      </Web3Provider>
    </BrowserRouter>
  );
}
