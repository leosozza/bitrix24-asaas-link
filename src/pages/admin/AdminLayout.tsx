import { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarGroup, SidebarGroupContent } from '@/components/ui/sidebar';
import { Shield, LayoutDashboard, Users, Package, ArrowLeft, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const items = [
  { title: 'Visão Geral', url: '/admin', icon: LayoutDashboard, exact: true },
  { title: 'Tenants', url: '/admin/tenants', icon: Users },
  { title: 'Planos', url: '/admin/plans', icon: Package },
];

export function AdminLayout({ children, title, description }: { children: ReactNode; title: string; description?: string }) {
  const location = useLocation();
  const { signOut } = useAuth();
  const isActive = (url: string, exact?: boolean) =>
    exact ? location.pathname === url : location.pathname.startsWith(url);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar collapsible="icon" className="border-r border-border/50">
          <SidebarHeader className="p-4">
            <NavLink to="/admin" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-foreground">Admin</span>
            </NavLink>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end={item.exact}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                            isActive(item.url, item.exact)
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                        >
                          <item.icon className="w-5 h-5 flex-shrink-0" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-4 space-y-2">
            <NavLink to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-muted">
              <ArrowLeft className="w-4 h-4" /> Voltar ao painel
            </NavLink>
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={signOut}>
              <LogOut className="w-5 h-5" /> Sair
            </Button>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col">
          <DashboardHeader title={title} description={description} />
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
