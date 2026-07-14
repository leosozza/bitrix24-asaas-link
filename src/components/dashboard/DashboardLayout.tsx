import { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import { SubscriptionGate } from '@/components/access/SubscriptionGate';
import { SubscriptionBanner } from '@/components/access/SubscriptionBanner';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  /** Set true on billing/settings routes so the user can update payment data even when locked. */
  allowWithoutSubscription?: boolean;
}

export function DashboardLayout({ children, title, description, allowWithoutSubscription }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col">
          <DashboardHeader title={title} description={description} />
          <SubscriptionBanner />
          <main className="flex-1 p-6 overflow-auto">
            <SubscriptionGate allowWithoutSubscription={allowWithoutSubscription}>
              {children}
            </SubscriptionGate>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
