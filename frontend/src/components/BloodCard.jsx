import { BLOOD_GROUPS, RH_LABELS, COMPONENTS, STATUSES } from "../contracts";

const STATUS_COLORS = {
  0: "#22c55e", // Available - green
  1: "#f59e0b", // Reserved - amber
  2: "#3b82f6", // Sold - blue
  3: "#8b5cf6", // Transfused - purple
  4: "#ef4444", // Expired - red
  5: "#6b7280", // Discarded - gray
};

export default function BloodCard({ info, children, highlight }) {
  const groupLabel = BLOOD_GROUPS[info.bloodGroup] || "?";
  const rhLabel = RH_LABELS[info.rhPositive] || "";
  const componentLabel = COMPONENTS[info.component] || "Unknown";
  const statusLabel = STATUSES[info.status] || "Unknown";
  const statusColor = STATUS_COLORS[info.status] || "#6b7280";

  const expiryDate = new Date(Number(info.expiryTime) * 1000);
  const collectionDate = new Date(Number(info.collectionTime) * 1000);
  const isExpired = Date.now() > expiryDate.getTime();

  const daysLeft = Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / 86400000));

  return (
    <div className={`blood-card ${isExpired ? "expired" : ""} ${highlight ? "highlight" : ""}`}>
      <div className="blood-card-header">
        <div className="blood-type-badge">
          <span className="blood-group">{groupLabel}</span>
          <span className="blood-rh">{rhLabel}</span>
        </div>
        <span className="status-badge" style={{ backgroundColor: statusColor }}>
          {statusLabel}
        </span>
      </div>

      <div className="blood-card-body">
        <div className="info-row">
          <span className="info-label">Component</span>
          <span className="info-value">{componentLabel}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Collected</span>
          <span className="info-value">{collectionDate.toLocaleDateString()}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Expires</span>
          <span className={`info-value ${isExpired ? "text-red" : ""}`}>
            {expiryDate.toLocaleDateString()}
            {!isExpired && <span className="days-left"> ({daysLeft}d left)</span>}
            {isExpired && <span className="days-left"> (EXPIRED)</span>}
          </span>
        </div>
        {info.donor && (
          <div className="info-row">
            <span className="info-label">Donor</span>
            <span className="info-value mono">{info.donor.slice(0, 6)}...{info.donor.slice(-4)}</span>
          </div>
        )}
      </div>

      {children && <div className="blood-card-actions">{children}</div>}
    </div>
  );
}
