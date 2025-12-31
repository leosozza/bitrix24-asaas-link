-- Create table for MCP connections
CREATE TABLE public.mcp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  mcp_url text NOT NULL,
  auth_type text NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none', 'bearer', 'api_key')),
  api_key_encrypted text,
  is_enabled boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  tools_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, mcp_url)
);

-- Create table for MCP tools
CREATE TABLE public.mcp_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.mcp_connections(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  input_schema jsonb,
  is_exposed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(connection_id, name)
);

-- Enable RLS
ALTER TABLE public.mcp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_tools ENABLE ROW LEVEL SECURITY;

-- RLS policies for mcp_connections
CREATE POLICY "Users can view their own MCP connections"
ON public.mcp_connections FOR SELECT
USING (auth.uid() = tenant_id);

CREATE POLICY "Users can insert their own MCP connections"
ON public.mcp_connections FOR INSERT
WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Users can update their own MCP connections"
ON public.mcp_connections FOR UPDATE
USING (auth.uid() = tenant_id);

CREATE POLICY "Users can delete their own MCP connections"
ON public.mcp_connections FOR DELETE
USING (auth.uid() = tenant_id);

-- RLS policies for mcp_tools
CREATE POLICY "Users can view their own MCP tools"
ON public.mcp_tools FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.mcp_connections mc
  WHERE mc.id = mcp_tools.connection_id
  AND mc.tenant_id = auth.uid()
));

CREATE POLICY "Users can insert their own MCP tools"
ON public.mcp_tools FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.mcp_connections mc
  WHERE mc.id = mcp_tools.connection_id
  AND mc.tenant_id = auth.uid()
));

CREATE POLICY "Users can update their own MCP tools"
ON public.mcp_tools FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.mcp_connections mc
  WHERE mc.id = mcp_tools.connection_id
  AND mc.tenant_id = auth.uid()
));

CREATE POLICY "Users can delete their own MCP tools"
ON public.mcp_tools FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.mcp_connections mc
  WHERE mc.id = mcp_tools.connection_id
  AND mc.tenant_id = auth.uid()
));

-- Triggers for updated_at
CREATE TRIGGER update_mcp_connections_updated_at
BEFORE UPDATE ON public.mcp_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mcp_tools_updated_at
BEFORE UPDATE ON public.mcp_tools
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();