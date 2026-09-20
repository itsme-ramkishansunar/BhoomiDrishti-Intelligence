import React from "react";
import emblem from "../../assets/branding/state-emblem-of-india.png";
import { Landmark, ShieldCheck } from "lucide-react";

const C = {
  primary: "#2F5C48",
  primaryDark: "#1E3E30",
  gold: "#8A6A32",
  ink: "#1B231C",
  inkSoft: "#586055",
  border: "#DBDFD4",
  surface: "#FFFFFF",
};

const FONT_HEAD = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const FONT_BODY = "'IBM Plex Sans', 'Inter', system-ui, sans-serif";

/**
 * The State Emblem is intentionally authorization-gated.
 * It must not be displayed in a way that creates an impression of official
 * Government of India status without the required authorization.
 */
export default function BrandMark({ compact = false, showCompliance = false }) {
  const authorized = String(import.meta.env.VITE_GOVERNMENT_EMBLEM_AUTHORIZED || "false").toLowerCase() === "true";

  return (
    <div className={compact ? "flex items-center gap-2" : "flex items-center gap-3"}>
      <div
        className="flex items-center justify-center rounded-lg overflow-hidden"
        style={{
          width: compact ? 32 : 48,
          height: compact ? 32 : 48,
          background: authorized ? "#101010" : C.primary,
          border: authorized ? "1px solid #2B2B2B" : "none",
          boxShadow: compact ? "none" : "0 8px 20px rgba(30,62,48,.14)",
          flexShrink: 0,
        }}
      >
        {authorized ? (
          <img
            src={emblem}
            alt="State Emblem of India"
            style={{ width: "100%", height: "100%", objectFit: "contain", padding: 3 }}
          />
        ) : (
          <Landmark size={compact ? 16 : 23} color="#fff" />
        )}
      </div>
      {!compact && (
        <div>
          <div style={{ fontFamily: FONT_HEAD, fontSize: 27, fontWeight: 700, color: C.ink, lineHeight: 1.05 }}>
            BhoomiDrishti
          </div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, marginTop: 3 }}>
            Land Acquisition Decision Support System
          </div>
          {showCompliance && (
            <div className="inline-flex items-center gap-1.5 mt-2 px-2 py-1 rounded" style={{ background: "#EEF0EA", color: C.inkSoft, border: `1px solid ${C.border}`, fontFamily: FONT_BODY, fontSize: 10.5 }}>
              <ShieldCheck size={12} color={C.primary} />
              {authorized ? "Authorized emblem display enabled" : "Government emblem display disabled pending authorization"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
