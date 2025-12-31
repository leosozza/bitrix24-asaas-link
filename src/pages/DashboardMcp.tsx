import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { DashboardLayout } from '@/components/dashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  Plus, 
  RefreshCw, 
  Trash2, 
  ChevronDown, 
  ChevronRight,
  Loader2,
  Plug,
  Wrench,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import asaasLogo from '@/assets/asaas-logo.png';
import bitrix24Logo from '@/assets/bitrix24-logo.png';

interface McpConnection {
  id: string;
  name: string;
  mcp_url: string;
  auth_type: string;
  is_enabled: boolean;
  last_sync_at: string | null;
  tools_count: number;
}

interface McpTool {
  id: string;
  connection_id: string;
  name: string;
  description: string | null;
  input_schema: unknown;
  is_exposed: boolean;
}

const MCP_PRESETS = [
  {
    id: 'asaas',
    name: 'Asaas',
    url: 'https://docs.asaas.com/mcp',
    authType: 'bearer',
    description: 'API de pagamentos Asaas',
    logo: asaasLogo,
  },
  {
    id: 'bitrix24',
    name: 'Bitrix24 REST API',
    url: 'https://mcp-dev.bitrix24.com/mcp',
    authType: 'none',
    description: 'Documentação e métodos da API REST do Bitrix24',
    logo: bitrix24Logo,
  },
];

export default function DashboardMcp() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<McpConnection[]>([]);
  const [tools, setTools] = useState<Record<string, McpTool[]>>({});
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customAuthType, setCustomAuthType] = useState<string>('none');
  const [isAdding, setIsAdding] = useState(false);
  const [discoveringId, setDiscoveringId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadConnections();
    }
  }, [user]);

  const loadConnections = async () => {
    setIsLoading(true);
    try {
      const { data: connectionsData, error: connError } = await supabase
        .from('mcp_connections')
        .select('*')
        .order('created_at', { ascending: false });

      if (connError) throw connError;

      setConnections(connectionsData || []);

      // Load tools for each connection
      if (connectionsData && connectionsData.length > 0) {
        const { data: toolsData, error: toolsError } = await supabase
          .from('mcp_tools')
          .select('*')
          .in('connection_id', connectionsData.map(c => c.id));

        if (!toolsError && toolsData) {
          const toolsByConnection: Record<string, McpTool[]> = {};
          for (const tool of toolsData) {
            if (!toolsByConnection[tool.connection_id]) {
              toolsByConnection[tool.connection_id] = [];
            }
            toolsByConnection[tool.connection_id].push(tool);
          }
          setTools(toolsByConnection);
        }
      }
    } catch (error) {
      console.error('Error loading connections:', error);
      toast.error('Erro ao carregar conexões MCP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddConnection = async () => {
    if (!user) return;

    let name = customName;
    let url = customUrl;
    let authType = customAuthType;

    if (selectedPreset && selectedPreset !== 'custom') {
      const preset = MCP_PRESETS.find(p => p.id === selectedPreset);
      if (preset) {
        name = preset.name;
        url = preset.url;
        authType = preset.authType;
      }
    }

    if (!name.trim() || !url.trim()) {
      toast.error('Nome e URL são obrigatórios');
      return;
    }

    setIsAdding(true);
    try {
      const { data, error } = await supabase
        .from('mcp_connections')
        .insert({
          tenant_id: user.id,
          name,
          mcp_url: url,
          auth_type: authType,
        })
        .select()
        .single();

      if (error) throw error;

      setConnections(prev => [data, ...prev]);
      setShowAddDialog(false);
      resetForm();
      toast.success('Conexão MCP adicionada!');
    } catch (error: any) {
      console.error('Error adding connection:', error);
      if (error.code === '23505') {
        toast.error('Esta URL MCP já está conectada');
      } else {
        toast.error('Erro ao adicionar conexão');
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleDiscoverTools = async (connection: McpConnection) => {
    setDiscoveringId(connection.id);
    try {
      const { data, error } = await supabase.functions.invoke('mcp-proxy', {
        body: {
          mcpUrl: connection.mcp_url,
          connectionId: connection.id,
        },
      });

      if (error) throw error;

      if (data.success && data.tools) {
        toast.success(`${data.tools.length} ferramenta(s) descoberta(s)!`);
        
        // Reload to get updated data
        await loadConnections();
        
        // Expand the connection to show tools
        setExpandedConnections(prev => new Set([...prev, connection.id]));
      } else {
        toast.warning('Nenhuma ferramenta encontrada neste MCP');
      }
    } catch (error) {
      console.error('Error discovering tools:', error);
      toast.error('Erro ao descobrir ferramentas');
    } finally {
      setDiscoveringId(null);
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('mcp_connections')
        .delete()
        .eq('id', connectionId);

      if (error) throw error;

      setConnections(prev => prev.filter(c => c.id !== connectionId));
      const newTools = { ...tools };
      delete newTools[connectionId];
      setTools(newTools);
      toast.success('Conexão removida');
    } catch (error) {
      console.error('Error deleting connection:', error);
      toast.error('Erro ao remover conexão');
    }
  };

  const handleToggleConnection = async (connectionId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('mcp_connections')
        .update({ is_enabled: enabled })
        .eq('id', connectionId);

      if (error) throw error;

      setConnections(prev =>
        prev.map(c => (c.id === connectionId ? { ...c, is_enabled: enabled } : c))
      );
    } catch (error) {
      console.error('Error toggling connection:', error);
      toast.error('Erro ao atualizar conexão');
    }
  };

  const handleToggleTool = async (toolId: string, exposed: boolean) => {
    try {
      const { error } = await supabase
        .from('mcp_tools')
        .update({ is_exposed: exposed })
        .eq('id', toolId);

      if (error) throw error;

      setTools(prev => {
        const updated = { ...prev };
        for (const connId in updated) {
          updated[connId] = updated[connId].map(t =>
            t.id === toolId ? { ...t, is_exposed: exposed } : t
          );
        }
        return updated;
      });
    } catch (error) {
      console.error('Error toggling tool:', error);
      toast.error('Erro ao atualizar ferramenta');
    }
  };

  const toggleExpanded = (connectionId: string) => {
    setExpandedConnections(prev => {
      const next = new Set(prev);
      if (next.has(connectionId)) {
        next.delete(connectionId);
      } else {
        next.add(connectionId);
      }
      return next;
    });
  };

  const resetForm = () => {
    setSelectedPreset('');
    setCustomName('');
    setCustomUrl('');
    setCustomAuthType('none');
  };

  const getPresetLogo = (url: string) => {
    const preset = MCP_PRESETS.find(p => p.url === url);
    return preset?.logo;
  };

  return (
    <>
      <Helmet>
        <title>Servidores MCP | ConnectPay</title>
      </Helmet>

      <DashboardLayout 
        title="Servidores MCP" 
        description="Conecte servidores MCP para descobrir e usar ferramentas de IA"
      >
        {/* Actions */}
        <div className="flex justify-end mb-6">
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar MCP
          </Button>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : connections.length === 0 ? (
          /* Empty State */
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Plug className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum MCP conectado</h3>
              <p className="text-muted-foreground text-center mb-4 max-w-md">
                Conecte servidores MCP como Asaas ou Bitrix24 para descobrir ferramentas 
                que podem ser usadas em integrações de IA.
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Primeiro MCP
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* Connections List */
          <div className="space-y-4">
            {connections.map((connection) => {
              const isExpanded = expandedConnections.has(connection.id);
              const connectionTools = tools[connection.id] || [];
              const logo = getPresetLogo(connection.mcp_url);

              return (
                <Card key={connection.id} className="border-border/50">
                  <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(connection.id)}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {logo ? (
                            <img src={logo} alt={connection.name} className="h-8 w-8 object-contain" />
                          ) : (
                            <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                              <Plug className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              {connection.name}
                              {connection.is_enabled ? (
                                <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
                                  Ativo
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Inativo
                                </Badge>
                              )}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              {connection.mcp_url}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={connection.is_enabled}
                            onCheckedChange={(checked) => handleToggleConnection(connection.id, checked)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDiscoverTools(connection)}
                            disabled={discoveringId === connection.id}
                          >
                            {discoveringId === connection.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                            <span className="ml-2 hidden sm:inline">
                              {discoveringId === connection.id ? 'Descobrindo...' : 'Descobrir'}
                            </span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteConnection(connection.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </div>
                      {connection.tools_count > 0 && (
                        <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                          <Wrench className="h-4 w-4" />
                          {connection.tools_count} ferramenta(s) disponível(is)
                          {connection.last_sync_at && (
                            <span className="text-xs">
                              • Última sincronização: {new Date(connection.last_sync_at).toLocaleString('pt-BR')}
                            </span>
                          )}
                        </div>
                      )}
                    </CardHeader>

                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        {connectionTools.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground">
                            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>Nenhuma ferramenta descoberta ainda.</p>
                            <p className="text-sm">Clique em "Descobrir" para buscar ferramentas.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {connectionTools.map((tool) => (
                              <div
                                key={tool.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded ${tool.is_exposed ? 'bg-primary/10' : 'bg-muted'}`}>
                                    <Wrench className={`h-4 w-4 ${tool.is_exposed ? 'text-primary' : 'text-muted-foreground'}`} />
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm">{tool.name}</p>
                                    {tool.description && (
                                      <p className="text-xs text-muted-foreground line-clamp-1">
                                        {tool.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {tool.is_exposed && (
                                    <Badge variant="secondary" className="text-xs">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Exposta
                                    </Badge>
                                  )}
                                  <Switch
                                    checked={tool.is_exposed}
                                    onCheckedChange={(checked) => handleToggleTool(tool.id, checked)}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        )}

        {/* Add MCP Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Servidor MCP</DialogTitle>
              <DialogDescription>
                Selecione um preset ou configure uma URL personalizada.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tipo de MCP</Label>
                <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um preset..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MCP_PRESETS.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        <div className="flex items-center gap-2">
                          <img src={preset.logo} alt={preset.name} className="h-4 w-4 object-contain" />
                          {preset.name}
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">URL Personalizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedPreset === 'custom' && (
                <>
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      placeholder="Nome do servidor MCP"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>URL do MCP</Label>
                    <Input
                      placeholder="https://exemplo.com/mcp"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Autenticação</Label>
                    <Select value={customAuthType} onValueChange={setCustomAuthType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        <SelectItem value="bearer">Bearer Token</SelectItem>
                        <SelectItem value="api_key">API Key</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {selectedPreset && selectedPreset !== 'custom' && (
                <div className="p-4 rounded-lg bg-muted/50">
                  {(() => {
                    const preset = MCP_PRESETS.find(p => p.id === selectedPreset);
                    if (!preset) return null;
                    return (
                      <div className="flex items-start gap-3">
                        <img src={preset.logo} alt={preset.name} className="h-8 w-8 object-contain mt-1" />
                        <div>
                          <p className="font-medium">{preset.name}</p>
                          <p className="text-sm text-muted-foreground">{preset.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">{preset.url}</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button onClick={handleAddConnection} disabled={isAdding || !selectedPreset}>
                {isAdding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adicionando...
                  </>
                ) : (
                  'Adicionar'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </>
  );
}