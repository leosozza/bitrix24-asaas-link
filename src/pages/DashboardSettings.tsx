import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { PlanCheckoutModal } from '@/components/checkout/PlanCheckoutModal';
import { DashboardLayout, StatusBadge } from '@/components/dashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Loader2, Save, Building2, Bell, CreditCard, Shield, FileText, Search, Pencil,
  Webhook, Copy, RefreshCw, Info, ChevronDown, Plus, CheckCircle2, Circle, Mail, Phone, MapPin,
} from 'lucide-react';

interface MunicipalService { id: string; code: string; description: string; }

type StepStatus = 'pending' | 'running' | 'done' | 'error';
interface UpdateStep { key: string; label: string; status: StepStatus; }

export default function DashboardSettings() {
  const { user } = useAuth();

  // ===== Company =====
  const [companyName, setCompanyName] = useState('Minha Empresa');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [showCompanyDialog, setShowCompanyDialog] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);

  // ===== Asaas =====
  const [asaasApiKey, setAsaasApiKey] = useState('');
  const [asaasEnv, setAsaasEnv] = useState<'sandbox' | 'production'>('production');
  const [asaasConnected, setAsaasConnected] = useState(false);
  const [showAsaasDialog, setShowAsaasDialog] = useState(false);
  const [showWebhookHelp, setShowWebhookHelp] = useState(false);
  const [editApiKey, setEditApiKey] = useState('');
  const [editEnv, setEditEnv] = useState<'sandbox' | 'production'>('production');
  const [savingAsaas, setSavingAsaas] = useState(false);

  // ===== Webhook =====
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [manualSecret, setManualSecret] = useState('');
  const [isSavingSecret, setIsSavingSecret] = useState(false);
  const [isRepairingWebhook, setIsRepairingWebhook] = useState(false);

  // ===== Fiscal =====
  const [fiscalOpen, setFiscalOpen] = useState(false);
  const [fiscalConfigId, setFiscalConfigId] = useState<string | null>(null);
  const [municipalServiceId, setMunicipalServiceId] = useState('');
  const [municipalServiceCode, setMunicipalServiceCode] = useState('');
  const [municipalServiceName, setMunicipalServiceName] = useState('');
  const [defaultIss, setDefaultIss] = useState('');
  const [autoEmitOnPayment, setAutoEmitOnPayment] = useState(false);
  const [observationsTemplate, setObservationsTemplate] = useState('');
  const [isSavingFiscal, setIsSavingFiscal] = useState(false);
  const [serviceSearch, setServiceSearch] = useState('');
  const [services, setServices] = useState<MunicipalService[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);

  // ===== Atualizar Integração (stepper) =====
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateSteps, setUpdateSteps] = useState<UpdateStep[]>([]);
  const [updateRunning, setUpdateRunning] = useState(false);
  const [updateSummary, setUpdateSummary] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // ===== Plano / Notificações / Segurança =====
  const [planCurrent, setPlanCurrent] = useState<any>(null);
  const [notifPrefs, setNotifPrefs] = useState({ email_transactions: true, payment_alerts: true, weekly_reports: false });
  const [savingNotif, setSavingNotif] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);
  const [delConfirm, setDelConfirm] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // ============= LOAD =============
  useEffect(() => {
    if (!user) return;
    (async () => {
      // Profile
      const { data: prof } = await supabase
        .from('profiles')
        .select('company_name, phone, address')
        .eq('id', user.id)
        .maybeSingle();
      if (prof) {
        setCompanyName(prof.company_name || 'Minha Empresa');
        setPhone(prof.phone || '');
        setAddress(prof.address || '');
      }
      // Asaas + Webhook
      const supaUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
      setWebhookUrl(`${supaUrl}/functions/v1/asaas-webhook`);
      const { data: cfg } = await supabase
        .from('asaas_configurations')
        .select('api_key, environment, is_active, webhook_secret, webhook_configured')
        .eq('tenant_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      if (cfg) {
        setAsaasApiKey(cfg.api_key || '');
        setAsaasEnv((cfg.environment as 'sandbox' | 'production') || 'production');
        setAsaasConnected(!!cfg.is_active);
        setWebhookSecret(cfg.webhook_secret || '');
        setWebhookConfigured(!!cfg.webhook_configured);
      }
      // Fiscal
      const { data: fc } = await supabase
        .from('fiscal_configurations')
        .select('*')
        .eq('tenant_id', user.id)
        .maybeSingle();
      if (fc) {
        setFiscalConfigId(fc.id);
        setMunicipalServiceId(fc.municipal_service_id || '');
        setMunicipalServiceCode(fc.municipal_service_code || '');
        setMunicipalServiceName(fc.municipal_service_name || '');
        setDefaultIss(fc.default_iss?.toString() || '');
        setAutoEmitOnPayment(fc.auto_emit_on_payment);
        setObservationsTemplate(fc.observations_template || '');
      }
      // Plan
      const { data: sub } = await supabase
        .from('tenant_subscriptions')
        .select('plan_id, status, current_period_end, transactions_used, subscription_plans(name, transaction_limit)')
        .eq('tenant_id', user.id)
        .maybeSingle();
      if (sub) {
        setPlanCurrent({
          plan_name: (sub as any).subscription_plans?.name,
          status: sub.status,
          period_end: sub.current_period_end,
          used: sub.transactions_used || 0,
          limit: (sub as any).subscription_plans?.transaction_limit ?? 0,
        });
      }
      // Notifications
      const { data: np } = await supabase
        .from('notification_preferences')
        .select('email_transactions, payment_alerts, weekly_reports')
        .eq('tenant_id', user.id)
        .maybeSingle();
      if (np) setNotifPrefs(np);
    })();
  }, [user]);

  // ============= HANDLERS =============
  const copyToClipboard = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(`${label} copiado!`); }
    catch { toast.error('Não foi possível copiar'); }
  };

  const openCompanyDialog = () => {
    setEditName(companyName); setEditPhone(phone); setEditAddress(address);
    setShowCompanyDialog(true);
  };
  const saveCompany = async () => {
    if (!user) return;
    setSavingCompany(true);
    const { error } = await supabase
      .from('profiles')
      .update({ company_name: editName, phone: editPhone, address: editAddress })
      .eq('id', user.id);
    setSavingCompany(false);
    if (error) return toast.error('Erro: ' + error.message);
    setCompanyName(editName); setPhone(editPhone); setAddress(editAddress);
    setShowCompanyDialog(false);
    toast.success('Dados da empresa salvos');
  };

  const openAsaasDialog = () => {
    setEditApiKey(asaasApiKey); setEditEnv(asaasEnv);
    setShowAsaasDialog(true);
  };
  const saveAsaas = async () => {
    if (!user) return;
    if (!editApiKey.trim()) return toast.error('Informe a API Key');
    setSavingAsaas(true);
    const { error } = await supabase
      .from('asaas_configurations')
      .upsert(
        { tenant_id: user.id, api_key: editApiKey.trim(), environment: editEnv, is_active: true },
        { onConflict: 'tenant_id' }
      );
    setSavingAsaas(false);
    if (error) return toast.error('Erro: ' + error.message);
    setAsaasApiKey(editApiKey.trim()); setAsaasEnv(editEnv); setAsaasConnected(true);
    setShowAsaasDialog(false);
    toast.success('Configuração Asaas salva');
  };

  const saveManualSecret = async () => {
    if (!user || !manualSecret.trim()) return;
    setIsSavingSecret(true);
    const { error } = await supabase
      .from('asaas_configurations')
      .update({ webhook_secret: manualSecret.trim(), webhook_configured: true })
      .eq('tenant_id', user.id)
      .eq('is_active', true);
    setIsSavingSecret(false);
    if (error) return toast.error(error.message);
    setWebhookSecret(manualSecret.trim()); setWebhookConfigured(true); setManualSecret('');
    toast.success('Token salvo');
  };

  const repairWebhook = async () => {
    if (!user) return;
    setIsRepairingWebhook(true);
    try {
      const { data: install } = await supabase
        .from('bitrix_installations').select('member_id').eq('tenant_id', user.id).maybeSingle();
      if (!install?.member_id) { toast.error('Instalação Bitrix não encontrada'); return; }
      const { data, error } = await supabase.functions.invoke('bitrix-config', {
        body: { memberId: install.member_id, action: 'repair_webhook' },
      });
      if (error) throw error;
      toast.success(data?.message || 'Webhook atualizado');
      setWebhookConfigured(true);
    } catch (e: any) {
      toast.error(e?.message || 'Erro');
    } finally { setIsRepairingWebhook(false); }
  };

  // ===== Atualizar Integração =====
  const STEPS_DEF: { key: string; label: string }[] = [
    { key: 'fields', label: 'Verificando campos do Deal' },
    { key: 'create_fields', label: 'Criando campos faltantes (UF_CRM_ASAAS_*)' },
    { key: 'robots', label: 'Verificando robôs de automação' },
    { key: 'placements', label: 'Verificando placements (abas CRM)' },
    { key: 'paysys', label: 'Sincronizando Pay System' },
  ];
  const openUpdateIntegration = async () => {
    if (!user) return;
    setUpdateSteps(STEPS_DEF.map(s => ({ ...s, status: 'pending' as StepStatus })));
    setUpdateSummary(null); setUpdateError(null); setUpdateRunning(true);
    setShowUpdateDialog(true);
    // Start animated stepper
    const tick = (idx: number, status: StepStatus) =>
      setUpdateSteps(prev => prev.map((s, i) => i === idx ? { ...s, status } : s));
    const stepInterval = 700;
    let animIdx = 0;
    const anim = setInterval(() => {
      if (animIdx > 0) tick(animIdx - 1, 'done');
      if (animIdx < STEPS_DEF.length) tick(animIdx, 'running');
      animIdx++;
      if (animIdx > STEPS_DEF.length) clearInterval(anim);
    }, stepInterval);
    try {
      const { data: install } = await supabase
        .from('bitrix_installations').select('member_id').eq('tenant_id', user.id).maybeSingle();
      if (!install?.member_id) throw new Error('Instalação Bitrix não encontrada');
      const { data, error } = await supabase.functions.invoke('bitrix-payment-iframe', {
        body: { memberId: install.member_id, action: 'repair_integration' },
      });
      if (error) throw error;
      // wait until animation finishes
      await new Promise(r => setTimeout(r, stepInterval * STEPS_DEF.length + 200));
      clearInterval(anim);
      setUpdateSteps(prev => prev.map(s => ({ ...s, status: 'done' as StepStatus })));
      setUpdateSummary(data?.message || 'Integração atualizada com sucesso.');
    } catch (e: any) {
      clearInterval(anim);
      setUpdateSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'error' as StepStatus } : s));
      setUpdateError(e?.message || 'Falha ao atualizar integração');
    } finally { setUpdateRunning(false); }
  };

  // ===== Fiscal =====
  const searchMunicipalServices = async (query: string) => {
    if (query.length < 3) { setServices([]); return; }
    setIsSearching(true);
    try {
      const { data: cfg } = await supabase.from('asaas_configurations').select('id').eq('tenant_id', user?.id).eq('is_active', true).maybeSingle();
      if (!cfg) { toast.error('Configure a integração Asaas primeiro'); return; }
      const response = await supabase.functions.invoke('asaas-invoice-process', {
        body: { action: 'list_municipal_services', tenantId: user?.id, description: query },
      });
      if (response.error) throw response.error;
      const list = response.data?.data || [];
      setServices(list.map((s: any) => ({ id: s.id, code: s.code || s.serviceCode, description: s.description })));
      setShowServiceDropdown(true);
    } catch (e) { console.error(e); }
    finally { setIsSearching(false); }
  };
  const selectService = (s: MunicipalService) => {
    setMunicipalServiceId(s.id); setMunicipalServiceCode(s.code); setMunicipalServiceName(s.description);
    setServiceSearch(''); setShowServiceDropdown(false);
  };
  const saveFiscal = async () => {
    if (!user) return;
    setIsSavingFiscal(true);
    try {
      const payload = {
        tenant_id: user.id,
        municipal_service_id: municipalServiceId || null,
        municipal_service_code: municipalServiceCode || null,
        municipal_service_name: municipalServiceName || null,
        default_iss: defaultIss ? parseFloat(defaultIss) : null,
        auto_emit_on_payment: autoEmitOnPayment,
        observations_template: observationsTemplate || null,
        is_active: true,
      };
      if (fiscalConfigId) {
        const { error } = await supabase.from('fiscal_configurations').update(payload).eq('id', fiscalConfigId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('fiscal_configurations').insert(payload).select().single();
        if (error) throw error;
        setFiscalConfigId(data.id);
      }
      toast.success('Configurações fiscais salvas');
    } catch (e: any) { toast.error(e?.message || 'Erro'); }
    finally { setIsSavingFiscal(false); }
  };

  // ===== Notifications =====
  const updateNotif = async (key: keyof typeof notifPrefs, value: boolean) => {
    if (!user) return;
    const next = { ...notifPrefs, [key]: value };
    setNotifPrefs(next);
    setSavingNotif(true);
    await supabase.from('notification_preferences').upsert(
      { tenant_id: user.id, ...next },
      { onConflict: 'tenant_id' }
    );
    setSavingNotif(false);
  };

  // ===== Security =====
  const submitChangePassword = async () => {
    if (!pwdCurrent || pwdNew.length < 8) return toast.error('Senha inválida');
    if (pwdNew !== pwdConfirm) return toast.error('As senhas não conferem');
    setSavingPwd(true);
    // Re-verify current password
    const { error: signErr } = await supabase.auth.signInWithPassword({ email: user!.email!, password: pwdCurrent });
    if (signErr) { setSavingPwd(false); return toast.error('Senha atual incorreta'); }
    const { error: upErr } = await supabase.auth.updateUser({ password: pwdNew });
    setSavingPwd(false);
    if (upErr) return toast.error(upErr.message);
    toast.success('Senha alterada com sucesso');
    setShowPasswordDialog(false);
    setPwdCurrent(''); setPwdNew(''); setPwdConfirm('');
  };
  const submitDeleteAccount = async () => {
    if (delConfirm !== 'EXCLUIR') return toast.error('Digite EXCLUIR para confirmar');
    setDeletingAccount(true);
    try {
      const { error } = await supabase.functions.invoke('bitrix-payment-iframe', {
        body: {
          memberId: (await supabase.from('bitrix_installations').select('member_id').eq('tenant_id', user!.id).maybeSingle()).data?.member_id,
          action: 'delete_account',
          data: { password: pwdCurrent },
        },
      });
      if (error) throw error;
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (e: any) { toast.error(e?.message || 'Erro ao excluir'); }
    finally { setDeletingAccount(false); }
  };

  const usagePct = planCurrent && planCurrent.limit > 0
    ? Math.min(100, Math.round((planCurrent.used / planCurrent.limit) * 100)) : 0;
  const envLabel = asaasEnv === 'production' ? 'Produção' : 'Sandbox';

  return (
    <>
      <Helmet><title>Configurações | ConnectPay</title></Helmet>
      <DashboardLayout title="Configurações" description="Gerencie sua conta e preferências">
        <div className="space-y-6 max-w-4xl">
          {/* Top action */}
          <div className="flex justify-end">
            <Button onClick={openUpdateIntegration} disabled={updateRunning}>
              <RefreshCw className={`mr-2 h-4 w-4 ${updateRunning ? 'animate-spin' : ''}`} />
              ↻ Atualizar Integração
            </Button>
          </div>

          {/* ============= COMPANY HEADER ============= */}
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">Dados da Empresa</div>
                  <div className="text-xl font-bold mb-2 truncate">{companyName || '—'}</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {user?.email && (<span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{user.email}</span>)}
                    {phone && (<span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{phone}</span>)}
                    {address && (<span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{address}</span>)}
                    {!phone && !address && (<span className="text-muted-foreground/70">Clique no lápis para preencher contato e endereço.</span>)}
                  </div>
                </div>
                <Button variant="outline" size="icon" onClick={openCompanyDialog} title="Editar empresa">
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ============= ASAAS CARD ============= */}
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Webhook className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-base">Asaas {asaasConnected ? 'Conectado' : 'Não configurado'}</span>
                    {asaasConnected && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-xs font-medium">
                        <CheckCircle2 className="h-3 w-3" />{envLabel}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">🟢 API Asaas v3</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">Ambiente: {envLabel}</span>
                    {webhookConfigured && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />Webhook registrado
                      </span>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setShowWebhookHelp(true)}>
                      <Info className="h-3.5 w-3.5 mr-1" />Como configurar
                    </Button>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={openAsaasDialog}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />Editar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ============= FISCAL (collapsible) ============= */}
          <Collapsible open={fiscalOpen} onOpenChange={setFiscalOpen}>
            <Card className="border-border/50">
              <CollapsibleTrigger asChild>
                <button className="w-full text-left">
                  <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">⚙️ Configuração Fiscal</CardTitle>
                        <CardDescription>Emissão de notas fiscais (NFSe)</CardDescription>
                      </div>
                      <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${fiscalOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </CardHeader>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6 pt-0">
                  <div className="space-y-2">
                    <Label>Serviço Municipal</Label>
                    <div className="relative">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar serviço municipal (mín. 3 caracteres)"
                          value={serviceSearch}
                          onChange={(e) => { setServiceSearch(e.target.value); searchMunicipalServices(e.target.value); }}
                          className="pl-9"
                        />
                        {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />}
                      </div>
                      {showServiceDropdown && services.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                          {services.map(s => (
                            <button key={s.id} type="button" className="w-full px-4 py-2 text-left hover:bg-accent text-sm" onClick={() => selectService(s)}>
                              <span className="font-medium">{s.code}</span>
                              <span className="text-muted-foreground ml-2">{s.description}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {municipalServiceName && (
                      <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm font-medium">Serviço selecionado:</p>
                        <p className="text-sm text-muted-foreground">{municipalServiceCode} - {municipalServiceName}</p>
                      </div>
                    )}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="iss">Alíquota ISS (%)</Label>
                      <Input id="iss" type="number" step="0.01" min="0" max="100" placeholder="Ex: 5.00" value={defaultIss} onChange={(e) => setDefaultIss(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="observations">Template de Observações</Label>
                    <Input id="observations" placeholder="Observações padrão" value={observationsTemplate} onChange={(e) => setObservationsTemplate(e.target.value)} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Emissão automática de NF</p>
                      <p className="text-sm text-muted-foreground">Emitir nota fiscal automaticamente quando um pagamento for confirmado</p>
                    </div>
                    <Switch checked={autoEmitOnPayment} onCheckedChange={setAutoEmitOnPayment} />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={saveFiscal} disabled={isSavingFiscal}>
                      {isSavingFiscal ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : <><Save className="mr-2 h-4 w-4" />Salvar Configurações Fiscais</>}
                    </Button>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* ============= SPLIT ============= */}
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Split de Pagamento</CardTitle>
                  <CardDescription>Configure divisões automáticas de pagamento entre contas Asaas</CardDescription>
                </div>
                <Button asChild>
                  <a href="/dashboard/splits"><Plus className="mr-2 h-4 w-4" />Gerenciar Splits</a>
                </Button>
              </div>
            </CardHeader>
          </Card>

          {/* ============= PLANO ============= */}
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <CardTitle>Plano e Uso</CardTitle>
                    {planCurrent && <StatusBadge status={planCurrent.status} />}
                  </div>
                  <CardDescription>Seu plano atual e consumo de transações</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {planCurrent ? (
                <>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium text-lg">Plano {planCurrent.plan_name || '—'}</p>
                      <p className="text-sm text-muted-foreground">
                        {planCurrent.status === 'trial' ? 'Trial até ' : 'Válido até '}
                        {planCurrent.period_end ? new Date(planCurrent.period_end).toLocaleDateString('pt-BR') : '—'}
                      </p>
                    </div>
                    <Button>Fazer Upgrade</Button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Transações utilizadas</span>
                      <span className="font-medium">{planCurrent.used} / {planCurrent.limit === -1 ? 'Ilimitado' : planCurrent.limit}</span>
                    </div>
                    <Progress value={usagePct} className="h-2" />
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum plano ativo.</p>
              )}
            </CardContent>
          </Card>

          {/* ============= NOTIFICAÇÕES ============= */}
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
              {[
                { k: 'email_transactions' as const, t: 'Notificações por email', d: 'Receba atualizações sobre suas transações' },
                { k: 'payment_alerts' as const, t: 'Alertas de pagamento', d: 'Notificações quando um pagamento for confirmado' },
                { k: 'weekly_reports' as const, t: 'Relatórios semanais', d: 'Resumo semanal de transações e métricas' },
              ].map((r, i) => (
                <div key={r.k}>
                  {i > 0 && <Separator className="mb-4" />}
                  <div className="flex items-center justify-between">
                    <div><p className="font-medium">{r.t}</p><p className="text-sm text-muted-foreground">{r.d}</p></div>
                    <Switch checked={notifPrefs[r.k]} onCheckedChange={(v) => updateNotif(r.k, v)} disabled={savingNotif} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ============= SEGURANÇA ============= */}
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
                <div><p className="font-medium">Alterar senha</p><p className="text-sm text-muted-foreground">Atualize sua senha de acesso</p></div>
                <Button variant="outline" onClick={() => setShowPasswordDialog(true)}>Alterar</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div><p className="font-medium text-destructive">Excluir conta</p><p className="text-sm text-muted-foreground">Remove permanentemente sua conta e todos os dados</p></div>
                <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>Excluir</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ============================================================
            MODAIS
           ============================================================ */}

        {/* Edit Company */}
        <Dialog open={showCompanyDialog} onOpenChange={setShowCompanyDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Dados da Empresa</DialogTitle>
              <DialogDescription>Atualize nome, contato e endereço da empresa.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label>Nome da Empresa</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Email</Label><Input value={user?.email || ''} disabled className="bg-muted" /></div>
              <div className="space-y-2"><Label>Telefone</Label><Input placeholder="(11) 99999-9999" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} /></div>
              <div className="space-y-2"><Label>Endereço</Label><Input placeholder="Rua, número, bairro, cidade" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCompanyDialog(false)}>Cancelar</Button>
              <Button onClick={saveCompany} disabled={savingCompany}>
                {savingCompany ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : <><Save className="mr-2 h-4 w-4" />Salvar Empresa</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Asaas */}
        <Dialog open={showAsaasDialog} onOpenChange={setShowAsaasDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Configuração Asaas</DialogTitle>
              <DialogDescription>Ambiente, chave API e webhook.</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 py-2">
              <div className="space-y-2">
                <Label>Ambiente</Label>
                <Select value={editEnv} onValueChange={(v: 'sandbox' | 'production') => setEditEnv(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox (Teste)</SelectItem>
                    <SelectItem value="production">Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Chave API</Label>
                <Input type="password" placeholder="$aact_..." value={editApiKey} onChange={(e) => setEditApiKey(e.target.value)} />
                <p className="text-xs text-muted-foreground">Em: Asaas → Configurações → Integrações</p>
              </div>
              <div className="flex justify-end">
                <Button onClick={saveAsaas} disabled={savingAsaas}>
                  {savingAsaas ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar Configuração
                </Button>
              </div>
              <Separator />
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2"><Webhook className="h-4 w-4" />Webhook</h4>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">URL do Webhook</Label>
                    <div className="flex gap-2">
                      <Input value={webhookUrl} readOnly className="font-mono text-xs" />
                      <Button type="button" variant="outline" size="icon" onClick={() => copyToClipboard(webhookUrl, 'URL')}><Copy className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Token salvo</Label>
                    <div className="flex gap-2">
                      <Input value={webhookSecret || '— não configurado —'} readOnly className="font-mono text-xs" />
                      {webhookSecret && <Button type="button" variant="outline" size="icon" onClick={() => copyToClipboard(webhookSecret, 'Token')}><Copy className="h-4 w-4" /></Button>}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Colar token gerado pelo Asaas</Label>
                    <div className="flex gap-2">
                      <Input placeholder="Cole o token aqui" value={manualSecret} onChange={(e) => setManualSecret(e.target.value)} className="font-mono text-xs" />
                      <Button onClick={saveManualSecret} disabled={isSavingSecret || !manualSecret.trim()}>
                        {isSavingSecret ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Token'}
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={repairWebhook} disabled={isRepairingWebhook}>
                      {isRepairingWebhook ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Tentando...</> : <><RefreshCw className="mr-2 h-4 w-4" />Tentar registrar novamente</>}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAsaasDialog(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Webhook help */}
        <Dialog open={showWebhookHelp} onOpenChange={setShowWebhookHelp}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>📘 Como configurar o webhook no Asaas</DialogTitle>
            </DialogHeader>
            <ol className="space-y-3 text-sm py-2 list-decimal list-inside">
              <li>Acesse o painel do Asaas → <strong>Configurações → Integrações → Webhooks</strong>.</li>
              <li>Clique em <strong>Novo webhook</strong>.</li>
              <li>Cole a <strong>URL do Webhook</strong> exibida na configuração Asaas.</li>
              <li>Defina um <strong>Token de autenticação</strong> (qualquer string forte).</li>
              <li>Selecione os eventos: <code>PAYMENT_CREATED</code>, <code>PAYMENT_CONFIRMED</code>, <code>PAYMENT_RECEIVED</code>, <code>PAYMENT_OVERDUE</code>, <code>PAYMENT_DELETED</code>, <code>PAYMENT_REFUNDED</code>.</li>
              <li>Salve e <strong>copie o token</strong> para colar no campo "Colar token gerado pelo Asaas".</li>
            </ol>
            <DialogFooter><Button onClick={() => setShowWebhookHelp(false)}>Entendi</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Atualizar Integração */}
        <Dialog open={showUpdateDialog} onOpenChange={(o) => { if (!updateRunning) setShowUpdateDialog(o); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>↻ Atualizar Integração</DialogTitle>
              <DialogDescription>Sincronizando campos, robôs e placements do Bitrix24.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {updateSteps.map(s => (
                <div key={s.key} className="flex items-center gap-3 text-sm">
                  {s.status === 'done' && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />}
                  {s.status === 'running' && <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />}
                  {s.status === 'pending' && <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />}
                  {s.status === 'error' && <Circle className="h-5 w-5 text-destructive shrink-0" />}
                  <span className={s.status === 'done' ? 'text-foreground' : s.status === 'running' ? 'text-foreground font-medium' : 'text-muted-foreground'}>
                    {s.label}
                  </span>
                </div>
              ))}
              {updateSummary && (
                <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                  ✅ <strong>Concluído!</strong><br />{updateSummary}
                </div>
              )}
              {updateError && (
                <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  ✗ {updateError}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setShowUpdateDialog(false)} disabled={updateRunning}>
                {updateRunning ? 'Aguarde...' : 'Concluir'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Change password */}
        <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Alterar senha</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label>Senha atual</Label><Input type="password" value={pwdCurrent} onChange={(e) => setPwdCurrent(e.target.value)} /></div>
              <div className="space-y-2"><Label>Nova senha</Label><Input type="password" value={pwdNew} onChange={(e) => setPwdNew(e.target.value)} /></div>
              <div className="space-y-2"><Label>Confirmar nova senha</Label><Input type="password" value={pwdConfirm} onChange={(e) => setPwdConfirm(e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>Cancelar</Button>
              <Button onClick={submitChangePassword} disabled={savingPwd}>
                {savingPwd ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : 'Alterar senha'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete account */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive">Excluir conta</DialogTitle>
              <DialogDescription>Essa ação é permanente. Todos os dados serão removidos.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label>Digite <strong>EXCLUIR</strong> para confirmar</Label><Input value={delConfirm} onChange={(e) => setDelConfirm(e.target.value)} /></div>
              <div className="space-y-2"><Label>Sua senha</Label><Input type="password" value={pwdCurrent} onChange={(e) => setPwdCurrent(e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={submitDeleteAccount} disabled={deletingAccount}>
                {deletingAccount ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Excluindo...</> : 'Excluir conta permanentemente'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </>
  );
}
