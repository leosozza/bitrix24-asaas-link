import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface DiscoverRequest {
  mcpUrl: string;
  connectionId?: string;
}

interface DiscoverResponse {
  success: boolean;
  tools?: McpTool[];
  error?: string;
}

// Try to discover tools from an MCP server
async function discoverMcpTools(mcpUrl: string): Promise<McpTool[]> {
  console.log(`[MCP-PROXY] Discovering tools from: ${mcpUrl}`);
  
  const tools: McpTool[] = [];
  
  // Try different MCP discovery methods
  const urlsToTry = [
    mcpUrl,
    mcpUrl.replace(/\/$/, '') + '/sse',
    mcpUrl.replace(/\/$/, '') + '/tools/list',
  ];
  
  for (const url of urlsToTry) {
    try {
      console.log(`[MCP-PROXY] Trying URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json, text/event-stream, */*',
        },
      });
      
      if (!response.ok) {
        console.log(`[MCP-PROXY] URL ${url} returned ${response.status}`);
        continue;
      }
      
      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();
      
      console.log(`[MCP-PROXY] Response from ${url}: ${text.substring(0, 500)}...`);
      
      // Try to parse as JSON
      if (contentType.includes('json') || text.startsWith('{') || text.startsWith('[')) {
        try {
          const data = JSON.parse(text);
          
          // Check if it's a tools list response
          if (Array.isArray(data)) {
            for (const item of data) {
              if (item.name) {
                tools.push({
                  name: item.name,
                  description: item.description || '',
                  inputSchema: item.inputSchema || item.parameters || {},
                });
              }
            }
          } else if (data.tools && Array.isArray(data.tools)) {
            for (const item of data.tools) {
              tools.push({
                name: item.name,
                description: item.description || '',
                inputSchema: item.inputSchema || item.parameters || {},
              });
            }
          } else if (data.result && Array.isArray(data.result.tools)) {
            for (const item of data.result.tools) {
              tools.push({
                name: item.name,
                description: item.description || '',
                inputSchema: item.inputSchema || item.parameters || {},
              });
            }
          }
          
          if (tools.length > 0) {
            console.log(`[MCP-PROXY] Found ${tools.length} tools from JSON response`);
            return tools;
          }
        } catch (parseError) {
          console.log(`[MCP-PROXY] Failed to parse JSON: ${parseError}`);
        }
      }
      
      // Try to parse as SSE/text with tool definitions
      if (text.includes('tool') || text.includes('method')) {
        // Extract tool-like patterns from the text
        const toolMatches = text.matchAll(/"name"\s*:\s*"([^"]+)".*?"description"\s*:\s*"([^"]*)"/g);
        for (const match of toolMatches) {
          tools.push({
            name: match[1],
            description: match[2] || '',
            inputSchema: {},
          });
        }
        
        if (tools.length > 0) {
          console.log(`[MCP-PROXY] Found ${tools.length} tools from text parsing`);
          return tools;
        }
      }
      
    } catch (error) {
      console.log(`[MCP-PROXY] Error fetching ${url}: ${error}`);
    }
  }
  
  // Fallback: try MCP JSON-RPC protocol
  try {
    const rpcUrl = mcpUrl.replace(/\/$/, '');
    console.log(`[MCP-PROXY] Trying JSON-RPC at: ${rpcUrl}`);
    
    const rpcResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }),
    });
    
    if (rpcResponse.ok) {
      const rpcData = await rpcResponse.json();
      console.log(`[MCP-PROXY] JSON-RPC response: ${JSON.stringify(rpcData).substring(0, 500)}`);
      
      if (rpcData.result && Array.isArray(rpcData.result.tools)) {
        for (const item of rpcData.result.tools) {
          tools.push({
            name: item.name,
            description: item.description || '',
            inputSchema: item.inputSchema || {},
          });
        }
      }
    }
  } catch (rpcError) {
    console.log(`[MCP-PROXY] JSON-RPC error: ${rpcError}`);
  }
  
  console.log(`[MCP-PROXY] Total tools discovered: ${tools.length}`);
  return tools;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle validation requests from external services
  if (req.method === "GET") {
    return new Response("OK", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();

    console.log(`[MCP-PROXY] Action: ${action}`);

    if (action === "discover" || url.pathname.endsWith("/mcp-proxy")) {
      const body: DiscoverRequest = await req.json();
      const { mcpUrl, connectionId } = body;

      if (!mcpUrl) {
        return new Response(
          JSON.stringify({ success: false, error: "mcpUrl is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[MCP-PROXY] Discovering tools for URL: ${mcpUrl}, connectionId: ${connectionId}`);

      const tools = await discoverMcpTools(mcpUrl);

      // If we have a connectionId, save the tools to the database
      if (connectionId && tools.length > 0) {
        console.log(`[MCP-PROXY] Saving ${tools.length} tools to database for connection ${connectionId}`);

        // Delete existing tools for this connection
        await supabase
          .from("mcp_tools")
          .delete()
          .eq("connection_id", connectionId);

        // Insert new tools
        const toolsToInsert = tools.map(tool => ({
          connection_id: connectionId,
          name: tool.name,
          description: tool.description || null,
          input_schema: tool.inputSchema || null,
          is_exposed: false,
        }));

        const { error: insertError } = await supabase
          .from("mcp_tools")
          .insert(toolsToInsert);

        if (insertError) {
          console.error(`[MCP-PROXY] Error inserting tools: ${insertError.message}`);
        }

        // Update connection with tools count and last sync
        await supabase
          .from("mcp_connections")
          .update({
            tools_count: tools.length,
            last_sync_at: new Date().toISOString(),
          })
          .eq("id", connectionId);
      }

      const response: DiscoverResponse = {
        success: true,
        tools,
      };

      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[MCP-PROXY] Error: ${error}`);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});