import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, companyName: string, phone?: string, bitrixDomain?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  linkBitrixInstallation: (bitrixDomain: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, companyName: string, phone?: string, bitrixDomain?: string) => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          company_name: companyName,
          phone: phone,
          bitrix_domain: bitrixDomain,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const linkBitrixInstallation = async (bitrixDomain: string) => {
    if (!user) return;
    
    try {
      // Try to link any pending installation with matching domain
      const { error } = await supabase
        .from('bitrix_installations')
        .update({ tenant_id: user.id, updated_at: new Date().toISOString() })
        .ilike('domain', `%${bitrixDomain}%`)
        .is('tenant_id', null)
        .eq('status', 'active');
      
      if (error) {
        console.error('Error linking Bitrix installation:', error);
      } else {
        console.log('Bitrix installation linked successfully');
      }
    } catch (err) {
      console.error('Error in linkBitrixInstallation:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, linkBitrixInstallation }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
