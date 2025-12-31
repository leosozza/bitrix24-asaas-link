import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import DashboardTransactions from "./pages/DashboardTransactions";
import DashboardSubscriptions from "./pages/DashboardSubscriptions";
import DashboardSplits from "./pages/DashboardSplits";
import DashboardIntegrations from "./pages/DashboardIntegrations";
import DashboardMcp from "./pages/DashboardMcp";
import DashboardSettings from "./pages/DashboardSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/transactions"
                element={
                  <ProtectedRoute>
                    <DashboardTransactions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/subscriptions"
                element={
                  <ProtectedRoute>
                    <DashboardSubscriptions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/splits"
                element={
                  <ProtectedRoute>
                    <DashboardSplits />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/integrations"
                element={
                  <ProtectedRoute>
                    <DashboardIntegrations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/mcp"
                element={
                  <ProtectedRoute>
                    <DashboardMcp />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/settings"
                element={
                  <ProtectedRoute>
                    <DashboardSettings />
                  </ProtectedRoute>
                }
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
