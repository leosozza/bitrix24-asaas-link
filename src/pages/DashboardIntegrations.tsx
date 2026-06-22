import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { DashboardLayout, IntegrationCard } from '@/components/dashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle, Loader2, Zap, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import bitrix24Logo from '@/assets/bitrix24-logo.png';
import asaasLogo from '@/assets/asaas-logo.png';
export default function DashboardIntegrations() {
  const { user } = useAuth();
  const [bitrixStatus, setBitrixStatus] = useState<'active' | 'expired' | 'revoked' | null>(null);
  const [asaasStatus, setAsaasStatus] = useState<'active' | 'expired' | 'revoked' | null>(null);
  
  const [showBitrixDialog, setShowBitrixDialog] = useState(false);
  const [showAsaasDialog, setShowAsaasDialog] = useState(false);
  
  const [bitrixDomain, setBitrixDomain] = useState('');
  const [asaasApiKey, setAsaasApiKey] = useState('');
  const [asaasEnvironment, setAsaasEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [isLoading, setIsLoading] = useState(false);

  // Asaas test charge state
  const [isTestingCharge, setIsTestingCharge] = useState(false);
  const [testBillingType, setTestBillingType] = useState<'PIX' | 'BOLETO' | 'CREDIT_CARD'>('PIX');
  const [testResult, setTestResult] = useState<any>(null);

  const handleTestCharge = async () => {
    if (!user) return;
    setIsTestingCharge(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('asaas-test-charge', {
        body: { tenant_id: user.id, billing_type: testBillingType },
      });
      if (error) throw error;
      setTestResult(data);
      if (data?.success) toast.success('Cobrança de teste criada com sucesso!');
      else toast.error(data?.error || 'Falha no teste');
    } catch (e: any) {
      setTestResult({ success: false, error: e?.message || String(e) });
      toast.error('Erro ao executar teste');
    } finally {
      setIsTestingCharge(false);
    }
  };

  const handleBitrixConnect = async () => {
    if (!bitrixDomain.trim()) {
      toast.error('Informe o domínio do seu portal Bitrix24');
      return;
    }

    setIsLoading(true);
    // Simular conexão - será substituído por OAuth real
    await new Promise(resolve => setTimeout(resolve, 1500));
    setBitrixStatus('active');
    setShowBitrixDialog(false);
    setIsLoading(false);
    toast.success('Bitrix24 conectado com sucesso!');
  };

  const handleAsaasConnect = async () => {
    if (!asaasApiKey.trim()) {
      toast.error('Informe sua API Key do Asaas');
      return;
    }

    setIsLoading(true);
    // Simular conexão - será substituído por validação real da API
    await new Promise(resolve => setTimeout(resolve, 1500));
    setAsaasStatus('active');
    setShowAsaasDialog(false);
    setIsLoading(false);
    toast.success('Asaas conectado com sucesso!');
  };

  const handleDisconnect = (integration: 'bitrix' | 'asaas') => {
    if (integration === 'bitrix') {
      setBitrixStatus(null);
      setBitrixDomain('');
      toast.success('Bitrix24 desconectado');
    } else {
      setAsaasStatus(null);
      setAsaasApiKey('');
      toast.success('Asaas desconectado');
    }
  };

  return (
    <>
      <Helmet>
        <title>Integrações | Asaas Pay by Thoth</title>
      </Helmet>

      <DashboardLayout title="Integrações" description="Configure suas integrações com Bitrix24 e Asaas">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Bitrix24 Card */}
          <IntegrationCard
            title="Bitrix24"
            description="Conecte seu CRM Bitrix24 para sincronizar negócios, faturas e contatos automaticamente."
            icon={<img src={bitrix24Logo} alt="Bitrix24" className="h-6 w-6 object-contain" />}
            status={bitrixStatus}
            onConfigure={() => setShowBitrixDialog(true)}
            onDisconnect={bitrixStatus === 'active' ? () => handleDisconnect('bitrix') : undefined}
          />

          {/* Asaas Card */}
          <IntegrationCard
            title="Asaas"
            description="Configure sua conta Asaas para processar cobranças via PIX, boleto e cartão de crédito."
            icon={<img src={asaasLogo} alt="Asaas" className="h-6 w-6 object-contain" />}
            status={asaasStatus}
            onConfigure={() => setShowAsaasDialog(true)}
            onDisconnect={asaasStatus === 'active' ? () => handleDisconnect('asaas') : undefined}
          />
        </div>

        {/* Connection Status */}
        {(bitrixStatus === 'active' || asaasStatus === 'active') && (
          <Card className="mt-6 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                Integrações Ativas
              </CardTitle>
              <CardDescription>
                Suas integrações estão funcionando corretamente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {bitrixStatus === 'active' && (
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <img src={bitrix24Logo} alt="Bitrix24" className="h-5 w-5 object-contain" />
                    <div>
                      <p className="font-medium">Bitrix24</p>
                      <p className="text-sm text-muted-foreground">{bitrixDomain || 'seuportal.bitrix24.com.br'}</p>
                    </div>
                  </div>
                  <span className="text-sm text-emerald-500 font-medium">Conectado</span>
                </div>
              )}
              {asaasStatus === 'active' && (
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <img src={asaasLogo} alt="Asaas" className="h-5 w-5 object-contain" />
                    <div>
                      <p className="font-medium">Asaas</p>
                      <p className="text-sm text-muted-foreground">
                        Ambiente: {asaasEnvironment === 'sandbox' ? 'Sandbox (Teste)' : 'Produção'}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-emerald-500 font-medium">Conectado</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Teste de Integração Asaas */}
        <Card className="mt-6 border-border/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Teste de Integração Asaas</CardTitle>
                <CardDescription>Valida sua API key e cria uma cobrança de R$ 5,00 de teste no Asaas</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label>Tipo de cobrança</Label>
                <div className="flex gap-2">
                  {(['PIX', 'BOLETO', 'CREDIT_CARD'] as const).map((t) => (
                    <Button key={t} type="button" variant={testBillingType === t ? 'default' : 'outline'} size="sm" onClick={() => setTestBillingType(t)}>
                      {t === 'CREDIT_CARD' ? 'Cartão' : t === 'BOLETO' ? 'Boleto' : 'PIX'}
                    </Button>
                  ))}
                </div>
              </div>
              <Button onClick={handleTestCharge} disabled={isTestingCharge}>
                {isTestingCharge ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Testando...</> : <><Zap className="mr-2 h-4 w-4" />Executar teste</>}
              </Button>
            </div>
            {testResult && (
              <div className={`rounded-lg border p-4 space-y-3 ${testResult.success ? 'border-green-500/30 bg-green-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
                <div className="flex items-center gap-2 font-medium">
                  {testResult.success
                    ? <><CheckCircle2 className="h-5 w-5 text-green-500" /><span>Teste concluído com sucesso</span></>
                    : <><XCircle className="h-5 w-5 text-destructive" /><span>Falha no teste</span></>}
                </div>
                {Array.isArray(testResult.log) && testResult.log.length > 0 && (
                  <pre className="text-xs bg-muted/50 rounded p-3 overflow-auto whitespace-pre-wrap">{testResult.log.join('\n')}</pre>
                )}
                {testResult.success && testResult.payment && (
                  <div className="grid gap-2 text-sm md:grid-cols-2">
                    <div><span className="text-muted-foreground">Ambiente:</span> <span className="font-mono">{testResult.environment}</span></div>
                    <div><span className="text-muted-foreground">Conta:</span> {testResult.account?.name || testResult.account?.email}</div>
                    <div><span className="text-muted-foreground">Cobrança ID:</span> <span className="font-mono">{testResult.payment.id}</span></div>
                    <div><span className="text-muted-foreground">Status:</span> {testResult.payment.status}</div>
                    <div><span className="text-muted-foreground">Valor:</span> R$ {Number(testResult.payment.value).toFixed(2)}</div>
                    <div><span className="text-muted-foreground">Vencimento:</span> {testResult.payment.dueDate}</div>
                    {testResult.payment.invoiceUrl && (
                      <a href={testResult.payment.invoiceUrl} target="_blank" rel="noreferrer" className="col-span-full inline-flex items-center gap-1 text-primary hover:underline">
                        Abrir cobrança no Asaas <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}
                {!testResult.success && testResult.error && (
                  <p className="text-sm text-destructive">{testResult.error}</p>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Dica: use o ambiente Sandbox para testes. A cobrança é real no ambiente configurado — exclua-a no painel Asaas se necessário.</p>
          </CardContent>
        </Card>

        {/* Bitrix24 Dialog */}
        <Dialog open={showBitrixDialog} onOpenChange={setShowBitrixDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Conectar Bitrix24</DialogTitle>
              <DialogDescription>
                Informe o domínio do seu portal Bitrix24 para iniciar a conexão OAuth.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="bitrix-domain">Domínio do Portal</Label>
                <Input
                  id="bitrix-domain"
                  placeholder="seuportal.bitrix24.com.br"
                  value={bitrixDomain}
                  onChange={(e) => setBitrixDomain(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Ex: minhaempresa.bitrix24.com.br
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBitrixDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleBitrixConnect} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  'Conectar'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Asaas Dialog */}
        <Dialog open={showAsaasDialog} onOpenChange={setShowAsaasDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configurar Asaas</DialogTitle>
              <DialogDescription>
                Informe sua API Key do Asaas para habilitar cobranças.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="asaas-env">Ambiente</Label>
                <Select value={asaasEnvironment} onValueChange={(v: 'sandbox' | 'production') => setAsaasEnvironment(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox (Teste)</SelectItem>
                    <SelectItem value="production">Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="asaas-key">API Key</Label>
                <Input
                  id="asaas-key"
                  type="password"
                  placeholder="$aact_YourApiKeyHere..."
                  value={asaasApiKey}
                  onChange={(e) => setAsaasApiKey(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Encontre sua API Key em: Asaas → Configurações → Integrações
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAsaasDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAsaasConnect} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validando...
                  </>
                ) : (
                  'Salvar'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </>
  );
}
