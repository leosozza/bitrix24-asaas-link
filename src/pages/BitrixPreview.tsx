const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const BitrixPreview = () => {
  const iframeSrc = `${SUPABASE_URL}/functions/v1/bitrix-payment-iframe?DOMAIN=preview.bitrix24.com&member_id=preview_mode&PLACEMENT=DEFAULT`;

  return (
    <div style={{ padding: "16px", fontFamily: "sans-serif", background: "#f5f5f5", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h2 style={{ marginBottom: 16 }}>Preview do Iframe Bitrix24</h2>
        <iframe
          src={iframeSrc}
          style={{ width: "100%", minHeight: "85vh", border: "1px solid #ddd", borderRadius: 8, background: "#fff" }}
        />
      </div>
    </div>
  );
};

export default BitrixPreview;
