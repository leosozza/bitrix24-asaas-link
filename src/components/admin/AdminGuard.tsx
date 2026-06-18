import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { Loader2 } from 'lucide-react';

export function AdminGuard({ children }: { children: ReactNode }) {
  const { isSuperAdmin, loading } = useIsSuperAdmin();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
