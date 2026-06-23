import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoginForm } from '@/components/auth/LoginForm';
import { SignupForm } from '@/components/auth/SignupForm';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import logoAsset from '@/assets/asaas-pay-thoth-logo.png.asset.json';

export default function Auth() {
  const [activeTab, setActiveTab] = useState('login');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading } = useAuth();

  // Get Bitrix params from URL (passed from installation flow)
  const memberId = searchParams.get('member_id') || undefined;
  const bitrixDomain = searchParams.get('domain') || undefined;
  const planSlug = searchParams.get('plan') || undefined;

  useEffect(() => {
    if (planSlug) setActiveTab('signup');
  }, [planSlug]);

  useEffect(() => {
    if (!loading && user) {
      navigate(planSlug ? `/dashboard/settings?checkout=${planSlug}` : '/dashboard');
    }
  }, [user, loading, navigate, planSlug]);

  const handleSuccess = () => {
    navigate(planSlug ? `/dashboard/settings?checkout=${planSlug}` : '/dashboard');
  };

  return (
    <>
      <Helmet>
        <title>Login | Asaas Pay by Thoth24 - Integração Bitrix24 + Asaas</title>
        <meta name="description" content="Acesse sua conta Asaas Pay by Thoth24 para gerenciar integrações de pagamento entre Bitrix24 e Asaas." />
      </Helmet>

      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
        <Link to="/" className="mb-8 inline-block">
          <img
            src={logoAsset.url}
            alt="Asaas Pay by Thoth24"
            className="h-12 w-auto"
          />
        </Link>

        <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Bem-vindo</CardTitle>
            <CardDescription>
              Acesse ou crie sua conta para começar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar Conta</TabsTrigger>
              </TabsList>
            <TabsContent value="login">
                <LoginForm onSuccess={handleSuccess} bitrixDomain={bitrixDomain} />
              </TabsContent>
              <TabsContent value="signup">
                <SignupForm onSuccess={handleSuccess} bitrixDomain={bitrixDomain} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="mt-8 text-sm text-muted-foreground">
          Ao continuar, você concorda com nossos{' '}
          <a href="#" className="text-primary hover:underline">Termos de Serviço</a>
          {' '}e{' '}
          <a href="#" className="text-primary hover:underline">Política de Privacidade</a>
        </p>
      </div>
    </>
  );
}
