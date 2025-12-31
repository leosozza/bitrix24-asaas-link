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
import { Plug, CreditCard, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DashboardIntegrations() {
  const [bitrixStatus, setBitrixStatus] = useState<'active' | 'expired' | 'revoked' | null>(null);
  const [asaasStatus, setAsaasStatus] = useState<'active' | 'expired' | 'revoked' | null>(null);
  
  const [showBitrixDialog, setShowBitrixDialog] = useState(false);
  const [showAsaasDialog, setShowAsaasDialog] = useState(false);
  
  const [bitrixDomain, setBitrixDomain] = useState('');
  const [asaasApiKey, setAsaasApiKey] = useState('');
  const [asaasEnvironment, setAsaasEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [isLoading, setIsLoading] = useState(false);

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
        <title>Integrações | ConnectPay</title>
      </Helmet>

      <DashboardLayout title="Integrações" description="Configure suas integrações com Bitrix24 e Asaas">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Bitrix24 Card */}
          <IntegrationCard
            title="Bitrix24"
            description="Conecte seu CRM Bitrix24 para sincronizar negócios, faturas e contatos automaticamente."
            icon={<Plug className="h-6 w-6" />}
            status={bitrixStatus}
            onConfigure={() => setShowBitrixDialog(true)}
            onDisconnect={bitrixStatus === 'active' ? () => handleDisconnect('bitrix') : undefined}
          />

          {/* Asaas Card */}
          <IntegrationCard
            title="Asaas"
            description="Configure sua conta Asaas para processar cobranças via PIX, boleto e cartão de crédito."
            icon={<CreditCard className="h-6 w-6" />}
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
                    <Plug className="h-5 w-5 text-primary" />
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
                    <CreditCard className="h-5 w-5 text-primary" />
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
