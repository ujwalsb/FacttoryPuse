const API_BASE = '/api/v1';

class ApiClient {
  private token: string | null = null;
  private selectedTenantId: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('fp_token', token);
    } else {
      localStorage.removeItem('fp_token');
      localStorage.removeItem('fp_user');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('fp_token');
    }
    return this.token;
  }

  setSelectedTenantId(tenantId: string | null) {
    this.selectedTenantId = tenantId;
  }

  getSelectedTenantId(): string | null {
    return this.selectedTenantId;
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}, retries: number = 3): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>)
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (this.selectedTenantId) {
      headers['x-tenant-id'] = this.selectedTenantId;
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
      });
    } catch (networkErr: any) {
      // If network connection failed (e.g. backend server briefly restarting during dev)
      if (retries > 0) {
        await new Promise(res => setTimeout(res, 800));
        return this.request<T>(endpoint, options, retries - 1);
      }
      throw networkErr;
    }

    let data: any = {};
    const text = await response.text();
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text || `HTTP ${response.status}: ${response.statusText}` };
    }

    // If server is 503 (backend initializing or restarting), transparently retry before failing
    if (response.status === 503 && retries > 0) {
      await new Promise(res => setTimeout(res, 800));
      return this.request<T>(endpoint, options, retries - 1);
    }

    if (response.status === 401) {
      // Only clear user session if it is NOT an admin-password verification requirement
      if (!data.requireAdminPassword && endpoint !== '/auth/login') {
        this.setToken(null);
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
    }

    if (response.status === 500 || response.status === 503) {
      window.dispatchEvent(
        new CustomEvent('server:error500', {
          detail: {
            endpoint,
            status: response.status,
            message: data.error || 'HTTP 500: Internal Server Error'
          }
        })
      );
    }

    if (!response.ok) {
      const err: any = new Error(data.error || data.message || `HTTP ${response.status}: ${response.statusText || 'API request failed'}`);
      err.status = response.status;
      err.requireAdminPassword = data.requireAdminPassword;
      throw err;
    }

    return data;
  }

  // Auth
  login(body: any) {
    return this.request('/auth/login', { method: 'POST', body: JSON.stringify(body) });
  }

  register(body: any) {
    return this.request('/auth/register', { method: 'POST', body: JSON.stringify(body) });
  }

  getMe() {
    return this.request('/auth/me');
  }

  logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  // Tenants
  getTenants() {
    return this.request('/tenants');
  }

  getTenant(id: string) {
    return this.request(`/tenants/${id}`);
  }

  createTenant(body: any) {
    return this.request('/tenants', { method: 'POST', body: JSON.stringify(body) });
  }

  updateTenant(id: string, body: any) {
    return this.request(`/tenants/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  }

  updateTenantStatus(id: string, status: string) {
    return this.request(`/tenants/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  }

  deleteTenant(id: string) {
    return this.request(`/tenants/${id}`, { method: 'DELETE' });
  }

  // Plants & Lines
  getPlants() {
    return this.request('/plants');
  }

  createPlant(body: any) {
    return this.request('/plants', { method: 'POST', body: JSON.stringify(body) });
  }

  getPlant(id: string) {
    return this.request(`/plants/${id}`);
  }

  getLines(plantId: string) {
    return this.request(`/plants/${plantId}/lines`);
  }

  createLine(plantId: string, body: any) {
    return this.request(`/plants/${plantId}/lines`, { method: 'POST', body: JSON.stringify(body) });
  }

  updatePlant(id: string, body: any) {
    return this.request(`/plants/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  }

  deletePlant(id: string) {
    return this.request(`/plants/${id}`, { method: 'DELETE' });
  }

  updateLine(plantId: string, lineId: string, body: any) {
    return this.request(`/plants/${plantId}/lines/${lineId}`, { method: 'PUT', body: JSON.stringify(body) });
  }

  deleteLine(plantId: string, lineId: string) {
    return this.request(`/plants/${plantId}/lines/${lineId}`, { method: 'DELETE' });
  }

  // Machines
  getMachines(params: Record<string, string> = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/machines${qs ? `?${qs}` : ''}`);
  }

  getMachine(id: string) {
    return this.request(`/machines/${id}`);
  }

  registerMachine(body: any) {
    return this.request('/machines', { method: 'POST', body: JSON.stringify(body) });
  }

  updateMachine(id: string, body: any, adminPassword?: string) {
    const payload = adminPassword ? { ...body, adminPassword } : body;
    return this.request(`/machines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
      headers: adminPassword ? { 'x-admin-password': adminPassword } : undefined
    });
  }

  archiveMachine(id: string, adminPassword?: string) {
    return this.request(`/machines/${id}/archive`, {
      method: 'PATCH',
      body: adminPassword ? JSON.stringify({ adminPassword }) : undefined,
      headers: adminPassword ? { 'x-admin-password': adminPassword } : undefined
    });
  }

  restartMachine(machineId: string, adminPassword: string, reason: string = 'Authorized Admin restart') {
    return this.request(`/machines/${machineId}/restart`, {
      method: 'POST',
      body: JSON.stringify({ adminPassword, reason }),
      headers: { 'x-admin-password': adminPassword }
    });
  }

  triggerServerRestart() {
    return this.request('/health/restart', { method: 'POST' });
  }

  restoreMachine(id: string) {
    return this.request(`/machines/${id}/restore`, { method: 'PATCH' });
  }

  getDiscoveredDevices(params?: { subnet?: string; interface?: string; mode?: string }) {
    const query = new URLSearchParams();
    if (params?.subnet) query.set('subnet', params.subnet);
    if (params?.interface) query.set('interface', params.interface);
    if (params?.mode) query.set('mode', params.mode);
    const queryString = query.toString();
    return this.request(`/machines/discovery/devices${queryString ? `?${queryString}` : ''}`);
  }

  getNetworkInterfaces() {
    return this.request('/machines/discovery/interfaces');
  }

  probeDevice(body: { ipAddress: string; port?: number; protocol?: string }) {
    return this.request('/machines/discovery/probe', { method: 'POST', body: JSON.stringify(body) });
  }

  toggleSimulator(isSimulated?: boolean) {
    return this.request('/machines/simulator/toggle', {
      method: 'POST',
      body: JSON.stringify({ isSimulated })
    });
  }

  getSimulatorStatus() {
    return this.request('/machines/simulator/status');
  }

  toggleDeviceConnection(machineId: string, body: { isConnected?: boolean; ipAddress?: string; port?: number; protocol?: string }) {
    return this.request(`/machines/${machineId}/device-connection`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  pingDevice(machineId: string) {
    return this.request(`/machines/${machineId}/ping`, {
      method: 'POST'
    });
  }

  updateMachineDiConfig(machineId: string, body: { digitalInputConfigs: any[]; wiseConnectionSettings?: any; adminPassword?: string }) {
    return this.request(`/machines/${machineId}/di-config`, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: body.adminPassword ? { 'x-admin-password': body.adminPassword } : undefined
    });
  }

  resetMachineDiConfig(machineId: string, adminPassword?: string) {
    return this.request(`/machines/${machineId}/di-config/reset`, {
      method: 'POST',
      body: adminPassword ? JSON.stringify({ adminPassword }) : undefined,
      headers: adminPassword ? { 'x-admin-password': adminPassword } : undefined
    });
  }

  pollWiseDevice(machineId: string) {
    return this.request(`/machines/${machineId}/wise/poll`, {
      method: 'POST'
    });
  }

  // Commands

  issueCommand(machineId: string, command: string, reason: string, adminPassword?: string) {
    const body: any = { command, reason };
    if (adminPassword) body.adminPassword = adminPassword;
    return this.request(`/commands/machines/${machineId}`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: adminPassword ? { 'x-admin-password': adminPassword } : undefined
    });
  }

  getMachineCommands(machineId: string) {
    return this.request(`/commands/machines/${machineId}`);
  }

  // Telemetry & Overview
  getOverview() {
    return this.request('/telemetry/overview');
  }

  getMachineHistory(machineId: string, limit: number = 60) {
    return this.request(`/telemetry/machines/${machineId}/history?limit=${limit}`);
  }

  // Alerts
  getAlerts(params: Record<string, string> = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/alerts${qs ? `?${qs}` : ''}`);
  }

  acknowledgeAlert(id: string) {
    return this.request(`/alerts/${id}/acknowledge`, { method: 'PATCH' });
  }

  resolveAlert(id: string, notes: string) {
    return this.request(`/alerts/${id}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify({ notes })
    });
  }

  getAlertRules() {
    return this.request('/alerts/rules');
  }

  createAlertRule(body: any) {
    return this.request('/alerts/rules', { method: 'POST', body: JSON.stringify(body) });
  }

  deleteAlertRule(id: string) {
    return this.request(`/alerts/rules/${id}`, { method: 'DELETE' });
  }

  // Maintenance
  getWorkOrders(params: Record<string, string> = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/maintenance${qs ? `?${qs}` : ''}`);
  }

  getWorkOrder(id: string) {
    return this.request(`/maintenance/${id}`);
  }

  createWorkOrder(body: any) {
    return this.request('/maintenance', { method: 'POST', body: JSON.stringify(body) });
  }

  updateWorkOrderStatus(id: string, body: any) {
    return this.request(`/maintenance/${id}/status`, { method: 'PATCH', body: JSON.stringify(body) });
  }

  // Reports
  getOeeReport(date?: string) {
    return this.request(`/reports/oee${date ? `?date=${date}` : ''}`);
  }

  getProductionReport() {
    return this.request('/reports/production');
  }

  getDowntimeReport() {
    return this.request('/reports/downtime');
  }

  // Gateways
  getGateways() {
    return this.request('/gateways');
  }

  registerGateway(body: any) {
    return this.request('/gateways', { method: 'POST', body: JSON.stringify(body) });
  }

  // Users
  getUsers() {
    return this.request('/users');
  }

  createUser(body: any) {
    return this.request('/users', { method: 'POST', body: JSON.stringify(body) });
  }

  updateUser(id: string, body: any) {
    return this.request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  }

  toggleUserStatus(id: string, isActive: boolean) {
    return this.request(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) });
  }

  deleteUser(id: string) {
    return this.request(`/users/${id}`, { method: 'DELETE' });
  }

  // Audit Logs
  getAuditLogs(params: Record<string, string> = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/audit-logs${qs ? `?${qs}` : ''}`);
  }

  // Health
  getHealth() {
    return this.request('/health');
  }

  triggerRestart() {
    return this.request('/health/restart', { method: 'POST' });
  }
}

export const api = new ApiClient();

