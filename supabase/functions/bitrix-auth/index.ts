import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface AuthRequest {
  email: string;
  password: string;
  companyName?: string;
  memberId: string;
  domain: string;
  action?: 'login' | 'signup';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Bitrix Auth Handler called');

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: AuthRequest = await req.json();
    const { email, password, companyName, memberId, domain, action = 'login' } = body;

    console.log('Auth action:', action, 'for domain:', domain, 'memberId:', memberId);

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email e senha são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    let userId: string;

    if (action === 'signup') {
      // Create new user
      if (!companyName) {
        return new Response(JSON.stringify({ error: 'Nome da empresa é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          company_name: companyName,
          bitrix_domain: domain,
        },
      });

      if (signUpError) {
        console.error('Signup error:', signUpError);
        
        // Check for duplicate email
        if (signUpError.message.includes('already') || signUpError.message.includes('exists')) {
          return new Response(JSON.stringify({ error: 'Este email já está cadastrado. Faça login.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        return new Response(JSON.stringify({ error: signUpError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      userId = signUpData.user.id;
      console.log('User created:', userId);

    } else {
      // Login existing user
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        console.error('List users error:', listError);
        return new Response(JSON.stringify({ error: 'Erro ao verificar usuário' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const user = users.find(u => u.email === email);
      
      if (!user) {
        return new Response(JSON.stringify({ error: 'Email não encontrado' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify password by trying to sign in
      const tempClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!);
      const { error: signInError } = await tempClient.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error('Sign in error:', signInError);
        return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      userId = user.id;
      console.log('User logged in:', userId);
    }

    // Link Bitrix installation to user (only if memberId is provided)
    if (memberId) {
      const { error: updateError } = await supabase
        .from('bitrix_installations')
        .update({ tenant_id: userId, updated_at: new Date().toISOString() })
        .eq('member_id', memberId)
        .is('tenant_id', null);

      if (updateError) {
        console.error('Update installation error:', updateError);
        // Don't fail the request, just log - installation might already be linked
      } else {
        console.log('Installation linked to user:', userId);
      }
    }

    // Check if user has Asaas config
    const { data: asaasConfig } = await supabase
      .from('asaas_configurations')
      .select('id, is_active')
      .eq('tenant_id', userId)
      .single();

    const needsAsaasConfig = !asaasConfig?.is_active;

    return new Response(JSON.stringify({ 
      success: true, 
      userId,
      needsAsaasConfig,
      message: action === 'signup' ? 'Conta criada com sucesso!' : 'Login realizado com sucesso!'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in bitrix-auth:', error);
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
