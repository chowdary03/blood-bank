import { useState } from "react";
import toast from "react-hot-toast";

export default function TxButton({ onClick, children, className = "btn btn-primary", ...props }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await onClick();
    } catch (err) {
      const msg = err?.reason || err?.message || "Transaction failed";
      toast.error(msg.length > 100 ? msg.slice(0, 100) + "..." : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button className={className} onClick={handleClick} disabled={loading} {...props}>
      {loading ? "Processing..." : children}
    </button>
  );
}
