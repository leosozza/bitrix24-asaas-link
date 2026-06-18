import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { DashboardLayout, StatusBadge } from '@/components/dashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save, Building2, Bell, CreditCard, Shield, FileText, Search, Zap, CheckCircle2, XCircle, ExternalLink, Webhook, Copy, RefreshCw } from 'lucide-react';

interface MunicipalService {
  id: string;
  code: string;
  description: string;
}

export default function DashboardSettings() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingFiscal, setIsSavingFiscal] = useState(false);
  
  // Form state
  const [companyName, setCompanyName] = useState('Minha Empresa');
  const [phone, setPhone] = useState('');
  
  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [paymentAlerts, setPaymentAlerts] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(false);

  // Fiscal configuration state
  const [fiscalConfigId, setFiscalConfigId] = useState<string | null>(null);
  const [municipalServiceId, setMunicipalServiceId] = useState('');
  const [municipalServiceCode, setMunicipalServiceCode] = useState('');
  const [municipalServiceName, setMunicipalServiceName] = useState('');
  const [defaultIss, setDefaultIss] = useState('');
  const [autoEmitOnPayment, setAutoEmitOnPayment] = useState(false);
  const [observationsTemplate, setObservationsTemplate] = useState('');
  
  // Municipal service search
  const [serviceSearch, setServiceSearch] = useState('');
  const [services, setServices] = useState<MunicipalService[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);

  // Test charge state
  const [isTestingCharge, setIsTestingCharge] = useState(false);
  const [testBillingType, setTestBillingType] = useState<'PIX' | 'BOLETO' | 'CREDIT_CARD'>('PIX');
  const [testResult, setTestResult] = useState<any>(null);

  // Webhook state
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [manualSecret, setManualSecret] = useState('');
  const [isRepairingWebhook, setIsRepairingWebhook] = useState(false);
  const [isRepairingIntegration, setIsRepairingIntegration] = useState(false);
  const [isSavingSecret, setIsSavingSecret] = useState(false);

  const loadWebhookInfo = async () => {
    if (!user) return;
    const supaUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
    setWebhookUrl(`${supaUrl}/functions/v1/asaas-webhook`);
    const { data } = await supabase
      .from('asaas_configurations')
      .select('webhook_secret, webhook_configured')
      .eq('tenant_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    if (data) {
      setWebhookSecret(data.webhook_secret || '');
      setWebhookConfigured(!!data.webhook_configured);
    }
  };

  useEffect(() => { loadWebhookInfo(); }, [user]);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado!`);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  const handleRepairWebhook = async () => {
    if (!user) return;
    setIsRepairingWebhook(true);
    try {
      const { data: install } = await supabase
        .from('bitrix_installations')
        .select('member_id')
        .eq('tenant_id', user.id)
        .maybeSingle();
      if (!install?.member_id) {
        toast.error('Instalação Bitrix não encontrada');
        return;
      }
      const { data, error } = await supabase.functions.invoke('bitrix-config', {
        body: { memberId: install.member_id, action: 'repair_webhook' },
      });
      if (error) throw error;
      toast.success(data?.message || 'Webhook atualizado');
      await loadWebhookInfo();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao reparar webhook');
    } finally {
      setIsRepairingWebhook(false);
    }
  };

  const handleRepairIntegration = async () => {
    if (!user) return;
    setIsRepairingIntegration(true);
    try {
      const { data: install } = await supabase
        .from('bitrix_installations')
        .select('member_id')
        .eq('tenant_id', user.id)
        .maybeSingle();
      if (!install?.member_id) {
        toast.error('Instalação Bitrix não encontrada');
        return;
      }
      const { data, error } = await supabase.functions.invoke('bitrix-payment-iframe', {
        body: { memberId: install.member_id, action: 'repair_integration' },
      });
      if (error) throw error;
      toast.success(data?.message || 'Integração marcada para reparo. Reabra o app no Bitrix24.');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao reparar integração');
    } finally {
      setIsRepairingIntegration(false);
    }
  };

  const handleSaveManualSecret = async () => {
    if (!user || !manualSecret.trim()) return;
    setIsSavingSecret(true);
    try {
      const { error } = await supabase
        .from('asaas_configurations')
        .update({ webhook_secret: manualSecret.trim(), webhook_configured: true })
        .eq('tenant_id', user.id)
        .eq('is_active', true);
      if (error) throw error;
      toast.success('Token do webhook salvo!');
      setManualSecret('');
      await loadWebhookInfo();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar token');
    } finally {
      setIsSavingSecret(false);
    }
  };

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
      if (data?.success) {
        toast.success('Cobrança de teste criada com sucesso!');
      } else {
        toast.error(data?.error || 'Falha no teste');
      }
    } catch (e: any) {
      setTestResult({ success: false, error: e?.message || String(e) });
      toast.error('Erro ao executar teste');
    } finally {
      setIsTestingCharge(false);
    }
  };

  // Mock subscription data
  const subscription = {
    plan: 'Starter',
    status: 'trial' as const,
    transactionsUsed: 23,
    transactionLimit: 100,
    periodEnd: '2024-02-10',
  };

  // Load fiscal configuration on mount
  useEffect(() => {
    const loadFiscalConfig = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('fiscal_configurations')
        .select('*')
        .eq('tenant_id', user.id)
        .maybeSingle();
      
      if (data) {
        setFiscalConfigId(data.id);
        setMunicipalServiceId(data.municipal_service_id || '');
        setMunicipalServiceCode(data.municipal_service_code || '');
        setMunicipalServiceName(data.municipal_service_name || '');
        setDefaultIss(data.default_iss?.toString() || '');
        setAutoEmitOnPayment(data.auto_emit_on_payment);
        setObservationsTemplate(data.observations_template || '');
      }
    };
    
    loadFiscalConfig();
  }, [user]);

  // Search municipal services
  const searchMunicipalServices = async (query: string) => {
    if (query.length < 3) {
      setServices([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const { data: asaasConfig } = await supabase
        .from('asaas_configurations')
        .select('id')
        .eq('tenant_id', user?.id)
        .eq('is_active', true)
        .maybeSingle();
      
      if (!asaasConfig) {
        toast.error('Configure a integração Asaas primeiro');
        return;
      }
      
      const response = await supabase.functions.invoke('asaas-invoice-process', {
        body: {
          action: 'list_municipal_services',
          tenantId: user?.id,
          description: query
        }
      });
      
      if (response.error) throw response.error;
      
      const serviceList = response.data?.data || [];
      setServices(serviceList.map((s: any) => ({
        id: s.id,
        code: s.code || s.serviceCode,
        description: s.description
      })));
      setShowServiceDropdown(true);
    } catch (error) {
      console.error('Erro ao buscar serviços:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const selectService = (service: MunicipalService) => {
    setMunicipalServiceId(service.id);
    setMunicipalServiceCode(service.code);
    setMunicipalServiceName(service.description);
    setServiceSearch('');
    setShowServiceDropdown(false);
  };

  const handleSaveProfile = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);
    toast.success('Configurações salvas com sucesso!');
  };

  const handleSaveFiscalConfig = async () => {
    if (!user) return;
    
    setIsSavingFiscal(true);
    try {
      const fiscalData = {
        tenant_id: user.id,
        municipal_service_id: municipalServiceId || null,
        municipal_service_code: municipalServiceCode || null,
        municipal_service_name: municipalServiceName || null,
        default_iss: defaultIss ? parseFloat(defaultIss) : null,
        auto_emit_on_payment: autoEmitOnPayment,
        observations_template: observationsTemplate || null,
        is_active: true
      };
      
      if (fiscalConfigId) {
        const { error } = await supabase
          .from('fiscal_configurations')
          .update(fiscalData)
          .eq('id', fiscalConfigId);
        
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('fiscal_configurations')
          .insert(fiscalData)
          .select()
          .single();
        
        if (error) throw error;
        setFiscalConfigId(data.id);
      }
      
      toast.success('Configurações fiscais salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar configurações fiscais:', error);
      toast.error('Erro ao salvar configurações fiscais');
    } finally {
      setIsSavingFiscal(false);
    }
  };

  const usagePercentage = (subscription.transactionsUsed / subscription.transactionLimit) * 100;

  return (
    <>
      <Helmet>
        <title>Configurações | ConnectPay</title>
      </Helmet>

      <DashboardLayout title="Configurações" description="Gerencie sua conta e preferências">
        <div className="space-y-6 max-w-4xl">
          {/* Company Profile */}
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Dados da Empresa</CardTitle>
                  <CardDescription>Informações básicas da sua conta</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company">Nome da Empresa</Label>
                  <Input
                    id="company"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={user?.email || ''}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    placeholder="(11) 99999-9999"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar Alterações
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Fiscal Configuration */}
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Configurações Fiscais</CardTitle>
                  <CardDescription>Configure a emissão de notas fiscais</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Municipal Service Search */}
              <div className="space-y-2">
                <Label>Serviço Municipal</Label>
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar serviço municipal (mín. 3 caracteres)"
                      value={serviceSearch}
                      onChange={(e) => {
                        setServiceSearch(e.target.value);
                        searchMunicipalServices(e.target.value);
                      }}
                      className="pl-9"
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                    )}
                  </div>
                  
                  {showServiceDropdown && services.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                      {services.map((service) => (
                        <button
                          key={service.id}
                          type="button"
                          className="w-full px-4 py-2 text-left hover:bg-accent text-sm"
                          onClick={() => selectService(service)}
                        >
                          <span className="font-medium">{service.code}</span>
                          <span className="text-muted-foreground ml-2">{service.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {municipalServiceName && (
                  <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium">Serviço selecionado:</p>
                    <p className="text-sm text-muted-foreground">
                      {municipalServiceCode} - {municipalServiceName}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="iss">Alíquota ISS (%)</Label>
                  <Input
                    id="iss"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="Ex: 5.00"
                    value={defaultIss}
                    onChange={(e) => setDefaultIss(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observations">Template de Observações</Label>
                <Input
                  id="observations"
                  placeholder="Observações padrão para as notas fiscais"
                  value={observationsTemplate}
                  onChange={(e) => setObservationsTemplate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Este texto será adicionado automaticamente em todas as notas fiscais emitidas
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Emissão automática de NF</p>
                  <p className="text-sm text-muted-foreground">
                    Emitir nota fiscal automaticamente quando um pagamento for confirmado
                  </p>
                </div>
                <Switch
                  checked={autoEmitOnPayment}
                  onCheckedChange={setAutoEmitOnPayment}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveFiscalConfig} disabled={isSavingFiscal}>
                  {isSavingFiscal ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar Configurações Fiscais
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Webhook Asaas */}
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Webhook className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle>Webhook Asaas</CardTitle>
                    <StatusBadge status={webhookConfigured ? 'active' : 'expired'} />
                  </div>
                  <CardDescription>
                    URL e token de autenticação do webhook (cabeçalho <code>asaas-access-token</code>)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>URL do Webhook</Label>
                <div className="flex gap-2">
                  <Input value={webhookUrl} readOnly className="font-mono text-xs" />
                  <Button type="button" variant="outline" size="icon" onClick={() => copyToClipboard(webhookUrl, 'URL')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Token (authToken) salvo</Label>
                <div className="flex gap-2">
                  <Input value={webhookSecret || '— não configurado —'} readOnly className="font-mono text-xs" />
                  {webhookSecret && (
                    <Button type="button" variant="outline" size="icon" onClick={() => copyToClipboard(webhookSecret, 'Token')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Este é o token usado para validar as notificações recebidas do Asaas.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Colar token gerado pelo Asaas</Label>
                <p className="text-xs text-muted-foreground">
                  Se você cadastrou o webhook manualmente no painel do Asaas e definiu um token próprio, cole-o aqui para que possamos validar as chamadas.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Cole o token do Asaas aqui"
                    value={manualSecret}
                    onChange={(e) => setManualSecret(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <Button onClick={handleSaveManualSecret} disabled={isSavingSecret || !manualSecret.trim()}>
                    {isSavingSecret ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={handleRepairWebhook} disabled={isRepairingWebhook}>
                  {isRepairingWebhook ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reparando...</>
                  ) : (
                    <><RefreshCw className="mr-2 h-4 w-4" />Registrar/Reparar webhook no Asaas</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Asaas Test Charge */}
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Teste de Integração Asaas</CardTitle>
                  <CardDescription>
                    Valida sua API key e cria uma cobrança de R$ 5,00 de teste no Asaas
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label>Tipo de cobrança</Label>
                  <div className="flex gap-2">
                    {(['PIX', 'BOLETO', 'CREDIT_CARD'] as const).map((t) => (
                      <Button
                        key={t}
                        type="button"
                        variant={testBillingType === t ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTestBillingType(t)}
                      >
                        {t === 'CREDIT_CARD' ? 'Cartão' : t === 'BOLETO' ? 'Boleto' : 'PIX'}
                      </Button>
                    ))}
                  </div>
                </div>
                <Button onClick={handleTestCharge} disabled={isTestingCharge}>
                  {isTestingCharge ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testando...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Executar teste
                    </>
                  )}
                </Button>
              </div>

              {testResult && (
                <div className={`rounded-lg border p-4 space-y-3 ${testResult.success ? 'border-green-500/30 bg-green-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
                  <div className="flex items-center gap-2 font-medium">
                    {testResult.success ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span>Teste concluído com sucesso</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-destructive" />
                        <span>Falha no teste</span>
                      </>
                    )}
                  </div>

                  {Array.isArray(testResult.log) && testResult.log.length > 0 && (
                    <pre className="text-xs bg-muted/50 rounded p-3 overflow-auto whitespace-pre-wrap">
{testResult.log.join('\n')}
                    </pre>
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
                        <a
                          href={testResult.payment.invoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="col-span-full inline-flex items-center gap-1 text-primary hover:underline"
                        >
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

              <p className="text-xs text-muted-foreground">
                Dica: use o ambiente Sandbox para testes. A cobrança é real no ambiente configurado — exclua-a no painel Asaas se necessário.
              </p>
            </CardContent>
          </Card>

          {/* Subscription */}

          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <CardTitle>Plano e Uso</CardTitle>
                    <StatusBadge status={subscription.status} />
                  </div>
                  <CardDescription>Seu plano atual e consumo de transações</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium text-lg">Plano {subscription.plan}</p>
                  <p className="text-sm text-muted-foreground">
                    Trial até {new Date(subscription.periodEnd).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <Button>Fazer Upgrade</Button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Transações utilizadas</span>
                  <span className="font-medium">
                    {subscription.transactionsUsed} / {subscription.transactionLimit}
                  </span>
                </div>
                <Progress value={usagePercentage} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {subscription.transactionLimit - subscription.transactionsUsed} transações restantes neste período
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Notificações</CardTitle>
                  <CardDescription>Configure como deseja ser notificado</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Notificações por email</p>
                  <p className="text-sm text-muted-foreground">
                    Receba atualizações sobre suas transações
                  </p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Alertas de pagamento</p>
                  <p className="text-sm text-muted-foreground">
                    Notificações quando um pagamento for confirmado
                  </p>
                </div>
                <Switch
                  checked={paymentAlerts}
                  onCheckedChange={setPaymentAlerts}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Relatórios semanais</p>
                  <p className="text-sm text-muted-foreground">
                    Resumo semanal de transações e métricas
                  </p>
                </div>
                <Switch
                  checked={weeklyReports}
                  onCheckedChange={setWeeklyReports}
                />
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Segurança</CardTitle>
                  <CardDescription>Configurações de segurança da conta</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Alterar senha</p>
                  <p className="text-sm text-muted-foreground">
                    Atualize sua senha de acesso
                  </p>
                </div>
                <Button variant="outline">Alterar</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-destructive">Excluir conta</p>
                  <p className="text-sm text-muted-foreground">
                    Remove permanentemente sua conta e todos os dados
                  </p>
                </div>
                <Button variant="destructive">Excluir</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </>
  );
}