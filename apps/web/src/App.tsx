import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext.js';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { TelemetryProvider } from './context/TelemetryContext.js';
import { Header } from './components/common/Header.js';
import { Sidebar } from './components/common/Sidebar.js';
import { ServerAutoRecoveryBanner } from './components/common/ServerAutoRecoveryBanner.js';

import { HomePage } from './pages/HomePage.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { MasterAdminPage } from './pages/MasterAdminPage.js';
import { PlantsPage } from './pages/PlantsPage.js';
import { MachinesPage } from './pages/MachinesPage.js';
import { MachineDetailPage } from './pages/MachineDetailPage.js';
import { OeePage } from './pages/OeePage.js';
import { MaintenancePage } from './pages/MaintenancePage.js';
import { AlertsPage } from './pages/AlertsPage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { GatewaysPage } from './pages/GatewaysPage.js';
import { UsersPage } from './pages/UsersPage.js';
import { AuditLogsPage } from './pages/AuditLogsPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { SystemHealthPage } from './pages/SystemHealthPage.js';
import { AccessDeniedPage } from './pages/AccessDeniedPage.js';

import { UserRole } from '@factorypulse/shared';
import { getDefaultRouteForRole } from './constants/rbac.js';

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-industrial-950 text-industrial-100 flex flex-col transition-colors duration-300 w-full overflow-x-hidden">
      <ServerAutoRecoveryBanner />
      <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1 overflow-hidden relative w-full">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 lg:p-8 w-full max-w-full">
          <div className="max-w-7xl mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
};

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-industrial-950 flex items-center justify-center font-mono text-sm text-industrial-400">
        Loading FactoryPulse session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <AppLayout>
        <AccessDeniedPage allowedRoles={allowedRoles} />
      </AppLayout>
    );
  }

  return <AppLayout>{children}</AppLayout>;
};

const RootRoute: React.FC = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  if (user.role === UserRole.COMPANY_ADMIN || user.role === UserRole.PRODUCTION_MANAGER) {
    return <DashboardPage />;
  }

  return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
};

const EntryRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-industrial-950 flex items-center justify-center font-mono text-sm text-industrial-400">
        Loading FactoryPulse session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <HomePage />;
  }

  return (
    <ProtectedRoute>
      <RootRoute />
    </ProtectedRoute>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TelemetryProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/home" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<EntryRoute />} />
              <Route
                path="/master-admin"
                element={
                  <ProtectedRoute allowedRoles={[UserRole.MASTER_ADMIN]}>
                    <MasterAdminPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/plants"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      UserRole.COMPANY_ADMIN,
                      UserRole.PLANT_IT_HEAD,
                      UserRole.PRODUCTION_MANAGER
                    ]}
                  >
                    <PlantsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/machines"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      UserRole.COMPANY_ADMIN,
                      UserRole.PLANT_IT_HEAD,
                      UserRole.PRODUCTION_MANAGER,
                      UserRole.MACHINE_OPERATOR,
                      UserRole.MAINTENANCE_ENGINEER
                    ]}
                  >
                    <MachinesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/machines/:id"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      UserRole.COMPANY_ADMIN,
                      UserRole.PLANT_IT_HEAD,
                      UserRole.PRODUCTION_MANAGER,
                      UserRole.MACHINE_OPERATOR,
                      UserRole.MAINTENANCE_ENGINEER
                    ]}
                  >
                    <MachineDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/oee"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      UserRole.COMPANY_ADMIN,
                      UserRole.PRODUCTION_MANAGER
                    ]}
                  >
                    <OeePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/maintenance"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      UserRole.COMPANY_ADMIN,
                      UserRole.MAINTENANCE_ENGINEER
                    ]}
                  >
                    <MaintenancePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/alerts"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      UserRole.COMPANY_ADMIN,
                      UserRole.PLANT_IT_HEAD,
                      UserRole.PRODUCTION_MANAGER,
                      UserRole.MACHINE_OPERATOR,
                      UserRole.MAINTENANCE_ENGINEER
                    ]}
                  >
                    <AlertsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      UserRole.COMPANY_ADMIN,
                      UserRole.PRODUCTION_MANAGER
                    ]}
                  >
                    <ReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/gateways"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      UserRole.COMPANY_ADMIN,
                      UserRole.PLANT_IT_HEAD
                    ]}
                  >
                    <GatewaysPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      UserRole.MASTER_ADMIN,
                      UserRole.COMPANY_ADMIN
                    ]}
                  >
                    <UsersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/audit-logs"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      UserRole.MASTER_ADMIN,
                      UserRole.COMPANY_ADMIN,
                      UserRole.PLANT_IT_HEAD
                    ]}
                  >
                    <AuditLogsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      UserRole.COMPANY_ADMIN
                    ]}
                  >
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/health"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      UserRole.MASTER_ADMIN,
                      UserRole.COMPANY_ADMIN,
                      UserRole.PLANT_IT_HEAD
                    ]}
                  >
                    <SystemHealthPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </TelemetryProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
