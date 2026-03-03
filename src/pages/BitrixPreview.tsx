import { useEffect, useState } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const BitrixPreview = () => {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/bitrix-payment-iframe?DOMAIN=preview.bitrix24.com&member_id=preview_mode&PLACEMENT=DEFAULT`
        );
        const text = await res.text();
        setHtml(text);
      } catch (err) {
        setHtml("<html><body><p>Erro ao carregar preview</p></body></html>");
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  return (
    <div style={{ padding: "16px", fontFamily: "sans-serif", background: "#f5f5f5", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h2 style={{ marginBottom: 16 }}>Preview do Iframe Bitrix24</h2>
        {loading ? (
          <p>Carregando...</p>
        ) : (
          <iframe
            srcDoc={html}
            style={{ width: "100%", minHeight: "85vh", border: "1px solid #ddd", borderRadius: 8, background: "#fff" }}
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        )}
      </div>
    </div>
  );
};

export default BitrixPreview;
