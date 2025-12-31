import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BITRIX_CLIENT_ID = Deno.env.get('BITRIX_CLIENT_ID');
const BITRIX_CLIENT_SECRET = Deno.env.get('BITRIX_CLIENT_SECRET');

interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  domain: string;
  member_id: string;
}

async function refreshBitrixToken(
  refreshToken: string,
  domain: string
): Promise<RefreshTokenResponse> {
  console.log(`Refreshing token for domain: ${domain}`);
  
  const response = await fetch('https://oauth.bitrix.info/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: BITRIX_CLIENT_ID || '',
      client_secret: BITRIX_CLIENT_SECRET || '',
      refresh_token: refreshToken,
    }),
  });
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Bitrix OAuth error: ${data.error_description || data.error}`);
  }
  
  return data;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Bitrix Refresh Token Handler called');
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Check for specific installation to refresh, or refresh all expiring
    const body = req.method === 'POST' ? await req.json() : {};
    const specificInstallationId = body.installationId;
    
    let query = supabase
      .from('bitrix_installations')
      .select('*')
      .eq('status', 'active')
      .not('refresh_token', 'is', null);
    
    if (specificInstallationId) {
      query = query.eq('id', specificInstallationId);
    } else {
      // Only refresh tokens expiring in the next hour
      const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      query = query.lt('expires_at', oneHourFromNow);
    }
    
    const { data: installations, error: fetchError } = await query;
    
    if (fetchError) {
      throw fetchError;
    }
    
    if (!installations || installations.length === 0) {
      console.log('No tokens need refreshing');
      return new Response(
        JSON.stringify({ success: true, message: 'No tokens need refreshing', refreshed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Found ${installations.length} token(s) to refresh`);
    
    const results = {
      success: [] as string[],
      failed: [] as { id: string; error: string }[],
    };
    
    for (const installation of installations) {
      try {
        if (!BITRIX_CLIENT_ID || !BITRIX_CLIENT_SECRET) {
          console.log(`Skipping ${installation.domain} - missing client credentials`);
          results.failed.push({ 
            id: installation.id, 
            error: 'Missing BITRIX_CLIENT_ID or BITRIX_CLIENT_SECRET' 
          });
          continue;
        }
        
        const tokenData = await refreshBitrixToken(
          installation.refresh_token,
          installation.domain
        );
        
        // Update the installation with new tokens
        const { error: updateError } = await supabase
          .from('bitrix_installations')
          .update({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
            scope: tokenData.scope,
            updated_at: new Date().toISOString(),
          })
          .eq('id', installation.id);
        
        if (updateError) {
          throw updateError;
        }
        
        console.log(`Successfully refreshed token for ${installation.domain}`);
        results.success.push(installation.id);
        
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to refresh token for ${installation.domain}:`, error);
        results.failed.push({ id: installation.id, error: errorMessage });
        
        // If refresh fails, mark as expired
        await supabase
          .from('bitrix_installations')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', installation.id);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        refreshed: results.success.length,
        failed: results.failed.length,
        details: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in bitrix-refresh-token:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
