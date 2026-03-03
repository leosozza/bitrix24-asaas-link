import { useEffect, useState } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

type PreviewMode = "dashboard" | "crm-tab";

const BitrixPreview = () => {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<PreviewMode>("dashboard");

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      try {
        const endpoint = mode === "dashboard"
          ? `${SUPABASE_URL}/functions/v1/bitrix-payment-iframe?DOMAIN=preview.bitrix24.com&member_id=preview_mode&PLACEMENT=DEFAULT`
          : `${SUPABASE_URL}/functions/v1/bitrix-crm-detail-tab?DOMAIN=preview.bitrix24.com&member_id=preview_mode&PLACEMENT=CRM_DEAL_DETAIL_TAB&entity_id=123`;
        const res = await fetch(endpoint);
        const text = await res.text();
        setHtml(text);
      } catch (err) {
        setHtml("<html><body><p>Erro ao carregar preview</p></body></html>");
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [mode]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 16px",
        background: "#1e293b",
        borderBottom: "1px solid #334155",
      }}>
        <span style={{ color: "#94a3b8", fontSize: "13px", fontWeight: 600, marginRight: "8px" }}>Preview:</span>
        <button
          onClick={() => setMode("dashboard")}
          style={{
            padding: "6px 14px",
            borderRadius: "8px",
            border: "none",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            background: mode === "dashboard" ? "#0066cc" : "#334155",
            color: mode === "dashboard" ? "#fff" : "#94a3b8",
            transition: "all 0.2s",
          }}
        >
          Dashboard
        </button>
        <button
          onClick={() => setMode("crm-tab")}
          style={{
            padding: "6px 14px",
            borderRadius: "8px",
            border: "none",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            background: mode === "crm-tab" ? "#0066cc" : "#334155",
            color: mode === "crm-tab" ? "#fff" : "#94a3b8",
            transition: "all 0.2s",
          }}
        >
          Aba CRM
        </button>
      </div>
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "#94a3b8" }}>
          Carregando...
        </div>
      ) : (
        <iframe
          srcDoc={html}
          style={{ flex: 1, width: "100%", border: "none" }}
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      )}
    </div>
  );
};

export default BitrixPreview;
