import { Header, Hero, Features, Pricing, FAQ, CTA, Footer } from "@/components/landing";
import { Helmet } from "react-helmet-async";

const Index = () => {
  return (
    <>
      <Helmet>
        <title>ConnectPay - Integração Bitrix24 + Asaas | Automatize Pagamentos</title>
        <meta 
          name="description" 
          content="Conecte o Bitrix24 ao Asaas e automatize cobranças via PIX, boleto e cartão. Integração oficial para o marketplace do Bitrix24. Teste grátis por 14 dias." 
        />
        <meta name="keywords" content="Bitrix24, Asaas, integração, pagamentos, PIX, boleto, cartão, CRM, automação" />
        <link rel="canonical" href="https://connectpay.com.br" />
      </Helmet>
      
      <div className="min-h-screen">
        <Header />
        <main>
          <Hero />
          <Features />
          <Pricing />
          <CTA />
          <FAQ />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;
