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

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif" }}>
        Carregando...
      </div>
    );
  }

  return (
    <iframe
      srcDoc={html}
      style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", border: "none" }}
      sandbox="allow-scripts allow-same-origin allow-forms"
    />
  );
};

export default BitrixPreview;
