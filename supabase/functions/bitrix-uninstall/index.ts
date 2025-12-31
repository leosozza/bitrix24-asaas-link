import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface BitrixUninstallEvent {
  event: string;
  auth: {
    domain: string;
    member_id: string;
    application_token: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Bitrix Uninstall Handler called');
    console.log('Method:', req.method);
    
    // Handle GET requests (marketplace validation)
    if (req.method === 'GET') {
      console.log('GET request - returning validation OK');
      return new Response('<html><body>OK</body></html>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }
    
    // Parse the incoming request body
    const contentType = req.headers.get('content-type') || '';
    const bodyText = await req.text();
    
    console.log('Content-Type:', contentType);
    console.log('Body length:', bodyText.length);
    
    // Handle empty body (marketplace validation POST)
    if (!bodyText || bodyText.trim() === '') {
      console.log('Empty body - returning validation OK');
      return new Response('<html><body>OK</body></html>', {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }
    
    let eventData: BitrixUninstallEvent;
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(bodyText);
      const authStr = params.get('auth') || '';
      eventData = {
        event: params.get('event') || 'ONAPPUNINSTALL',
        auth: authStr ? JSON.parse(authStr) : {},
      };
    } else {
      eventData = JSON.parse(bodyText);
    }
    
    console.log('Uninstall event data:', JSON.stringify(eventData));
    
    const { auth } = eventData;
    
    if (!auth?.domain || !auth?.member_id) {
      console.error('Missing required auth data for uninstall');
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Find the installation
    const { data: installation, error: findError } = await supabase
      .from('bitrix_installations')
      .select('id')
      .eq('domain', auth.domain)
      .eq('member_id', auth.member_id)
      .single();

    if (findError || !installation) {
      console.log('Installation not found, nothing to uninstall');
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark installation as revoked and clear sensitive data
    const { error: updateError } = await supabase
      .from('bitrix_installations')
      .update({
        status: 'revoked',
        access_token: null,
        refresh_token: null,
        application_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', installation.id);

    if (updateError) {
      console.error('Error updating installation status:', updateError);
      throw updateError;
    }

    // Deactivate all pay systems for this installation
    const { error: paySystemError } = await supabase
      .from('bitrix_pay_systems')
      .update({ is_active: false })
      .eq('installation_id', installation.id);

    if (paySystemError) {
      console.error('Error deactivating pay systems:', paySystemError);
    }

    // Log the uninstall event
    console.log(`Successfully processed uninstall for domain: ${auth.domain}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in bitrix-uninstall:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
