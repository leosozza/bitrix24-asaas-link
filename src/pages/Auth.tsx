import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoginForm } from '@/components/auth/LoginForm';
import { SignupForm } from '@/components/auth/SignupForm';
import { useAuth } from '@/contexts/AuthContext';
import { Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Auth() {
  const [activeTab, setActiveTab] = useState('login');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading } = useAuth();

  // Get Bitrix params from URL (passed from installation flow)
  const memberId = searchParams.get('member_id') || undefined;
  const bitrixDomain = searchParams.get('domain') || undefined;

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const handleSuccess = () => {
    navigate('/dashboard');
  };

  return (
    <>
      <Helmet>
        <title>Login | ConnectPay - Integração Bitrix24 + Asaas</title>
        <meta name="description" content="Acesse sua conta ConnectPay para gerenciar integrações de pagamento entre Bitrix24 e Asaas." />
      </Helmet>

      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
        <Link to="/" className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
            <Zap className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold text-foreground">ConnectPay</span>
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
