import { useEffect, useState } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const BitrixPreview = () => {
  const [memberId, setMemberId] = useState("");
  const [iframeSrc, setIframeSrc] = useState("");

  const loadPreview = () => {
    if (!memberId.trim()) return;
    const url = `${SUPABASE_URL}/functions/v1/bitrix-payment-iframe?DOMAIN=preview.bitrix24.com&member_id=${encodeURIComponent(memberId)}&PLACEMENT=DEFAULT`;
    setIframeSrc(url);
  };

  return (
    <div style={{ padding: "16px", fontFamily: "sans-serif", background: "#f5f5f5", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h2 style={{ marginBottom: 12 }}>Preview do Iframe Bitrix24</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            type="text"
            placeholder="member_id da instalação"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadPreview()}
            style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14 }}
          />
          <button
            onClick={loadPreview}
            style={{ padding: "8px 20px", borderRadius: 6, background: "#0066cc", color: "#fff", border: "none", cursor: "pointer", fontSize: 14 }}
          >
            Carregar
          </button>
        </div>
        {iframeSrc && (
          <iframe
            src={iframeSrc}
            style={{ width: "100%", minHeight: "80vh", border: "1px solid #ddd", borderRadius: 8, background: "#fff" }}
          />
        )}
      </div>
    </div>
  );
};

export default BitrixPreview;
