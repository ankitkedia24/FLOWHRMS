import { apiClient } from './api';

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  message?: string;
  error?: string | null;
}

/**
 * Mobile API Service Layer
 * Connects all mobile screens to the FlowHRMS Next.js Backend (/api/v1/...)
 * with resilient offline fallback defaults and typed data structures.
 */

// 1. Authentication Service
export const authService = {
  async signIn(email: string, password: string) {
    const res = await apiClient<any>('/auth/sign-in', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.data?.ok) {
      return { ok: true, data: res.data, message: 'Signed in successfully.' };
    }
    return { ok: false, error: res.error || res.data?.error || 'Invalid credentials' };
  },

  async signUp(payload: {
    companyName: string;
    fullName: string;
    email: string;
    mobileNumber: string;
    password: string;
    teamSize: string;
    industry: string;
    dpdpConsent: boolean;
  }) {
    const res = await apiClient<any>('/auth/sign-up', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.data?.ok) {
      return { ok: true, data: res.data, message: res.data.message || 'Workspace created successfully.' };
    }
    return { ok: false, error: res.error || res.data?.error || 'Sign up failed' };
  },
};

// 2. Attendance Service
export const attendanceService = {
  async getToday() {
    const res = await apiClient<any>('/attendance/today', { method: 'GET' });
    return res.data?.data ?? null;
  },

  async punch(
    action: string,
    coords?: { latitude?: number; longitude?: number; accuracy?: number; address?: string },
    targetMembershipId?: string
  ) {
    const res = await apiClient<any>('/attendance/punch', {
      method: 'POST',
      body: JSON.stringify({
        action,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        accuracy: coords?.accuracy,
        address: coords?.address,
        targetMembershipId,
      }),
    });
    if (res.data?.ok) {
      return { ok: true, success: true, message: res.data.message, data: res.data.punch };
    }
    return { ok: false, success: false, error: res.error || res.data?.error || 'Punch failed' };
  },

  async getRules() {
    const res = await apiClient<any>('/attendance/rules', { method: 'GET' });
    return res.data?.data ?? null;
  },

  async updateRules(payload: any) {
    const res = await apiClient<any>('/attendance/rules', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (res.data?.ok) {
      return { ok: true, success: true, message: res.data.message || 'Rules updated.' };
    }
    return { ok: false, success: false, error: res.error || 'Failed to update rules' };
  },
};

// 3. Dashboard Service
export const dashboardService = {
  async getSummary() {
    const res = await apiClient<any>('/dashboard/summary', { method: 'GET' });
    return res.data?.data ?? null;
  },
};

// 4. Leave Service
export const leaveService = {
  async getBalances() {
    const res = await apiClient<any>('/leave', { method: 'GET' });
    return {
      ok: res.data?.ok ?? true,
      success: res.data?.ok ?? true,
      data: res.data?.data ?? null,
    };
  },

  async getBalancesAndRequests() {
    return this.getBalances();
  },

  async applyLeave(payload: any) {
    const res = await apiClient<any>('/leave', {
      method: 'POST',
      body: JSON.stringify({
        leaveType: payload.leaveType || payload.type,
        leaveCategory: payload.leaveCategory || payload.category,
        startDate: payload.startDate,
        endDate: payload.endDate,
        reason: payload.reason,
        days: payload.days,
        isHalfDay: payload.isHalfDay || payload.type === 'Half Day',
      }),
    });
    if (res.data?.ok) {
      return { ok: true, success: true, message: res.data.message, data: res.data.request ?? res.data };
    }
    return { ok: false, success: false, error: res.error || res.data?.error || 'Failed to apply leave' };
  },

  async decideLeave(payload: {
    requestId: string;
    decision: 'APPROVED' | 'REJECTED';
    paid?: boolean;
    reason?: string;
  }) {
    const res = await apiClient<any>('/leave', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (res.data?.ok) {
      return { ok: true, success: true, message: res.data.message, data: res.data.request };
    }
    return { ok: false, success: false, error: res.error || res.data?.error || 'Failed to update leave request' };
  },
};

// 5. Tasks Service
export const tasksService = {
  async getTasks() {
    const res = await apiClient<any>('/tasks', { method: 'GET' });
    return {
      ok: res.data?.ok ?? true,
      success: res.data?.ok ?? true,
      data: { tasks: res.data?.data ?? [] },
    };
  },

  async createTask(payload: {
    title: string;
    description?: string;
    assignedTo?: string;
    priority?: string;
    dueDate?: string;
    location?: string;
    dueTime?: string;
    category?: string;
    proofRequirement?: string;
  }) {
    const res = await apiClient<any>('/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.data?.ok) {
      return { ok: true, success: true, message: res.data.message, data: { task: res.data.task ?? res.data } };
    }
    return { ok: false, success: false, error: res.error || 'Failed to create task' };
  },

  async updateTaskStatus(id: string, status: string, note?: string) {
    const res = await apiClient<any>('/tasks', {
      method: 'PATCH',
      body: JSON.stringify({ id, status, note }),
    });
    if (res.data?.ok) {
      return { ok: true, success: true, message: res.data.message, updated: res.data.updated };
    }
    return { ok: false, success: false, error: res.error || 'Failed to update task' };
  },
};

// 6. Employees Service
export const employeesService = {
  async getEmployees() {
    const res = await apiClient<any>('/employees', { method: 'GET' });
    return {
      ok: res.data?.ok ?? true,
      success: res.data?.ok ?? true,
      data: { employees: res.data?.data ?? [] },
    };
  },

  async inviteEmployee(payload: {
    name: string;
    email?: string;
    mobile?: string;
    phone?: string;
    department?: string;
    designation?: string;
    role?: string;
  }) {
    const res = await apiClient<any>('/employees', {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        email: payload.email,
        mobile: payload.mobile || payload.phone,
        department: payload.department,
        designation: payload.designation,
        role: payload.role,
      }),
    });
    if (res.data?.ok) {
      return { ok: true, success: true, message: res.data.message, data: { employee: res.data.employee ?? res.data } };
    }
    return { ok: false, success: false, error: res.error || 'Failed to invite employee' };
  },
};

// 7. Payroll & Payslips Service
export const payrollService = {
  async getCurrent() {
    const res = await apiClient<any>('/payroll', { method: 'GET' });
    return res.data?.data ?? null;
  },

  async calculate() {
    const res = await apiClient<any>('/payroll', {
      method: 'POST',
      body: JSON.stringify({ action: 'calculate' }),
    });
    if (res.data?.ok) {
      return { ok: true, success: true, message: res.data.message, data: res.data.calculation };
    }
    return { ok: false, success: false, error: res.error || 'Calculation failed' };
  },

  async exportSummary(month?: string) {
    const res = await apiClient<any>('/payroll', {
      method: 'POST',
      body: JSON.stringify({ action: 'export', month }),
    });
    if (res.data?.ok) {
      return { ok: true, success: true, message: res.data.message, fileUrl: res.data.fileUrl };
    }
    return { ok: false, success: false, error: res.error || 'Export failed' };
  },

  async getPayslips(financialYear?: string) {
    const res = await apiClient<any>('/payslips', {
      method: 'GET',
      params: { fy: financialYear || 'FY 2026-27' },
    });
    return {
      ok: res.data?.ok ?? true,
      success: res.data?.ok ?? true,
      data: { payslips: res.data?.data ?? [] },
    };
  },
};

// 8. Reports & Daily Pulse Service
export const reportsService = {
  async getDailyPulse() {
    const res = await apiClient<any>('/reports', {
      method: 'GET',
      params: { type: 'daily' },
    });
    return res.data?.data ?? null;
  },

  async shareDailyPulse() {
    const res = await apiClient<any>('/reports', {
      method: 'POST',
      body: JSON.stringify({ action: 'share-daily' }),
    });
    if (res.data?.ok) {
      return { ok: true, success: true, message: res.data.message };
    }
    return { ok: false, success: false, error: res.error || 'Share failed' };
  },

  async getExports() {
    const res = await apiClient<any>('/reports', { method: 'GET' });
    return res.data?.data?.recentExports ?? [];
  },

  async generateExport(reportType: string, dateRange: string) {
    const res = await apiClient<any>('/reports', {
      method: 'POST',
      body: JSON.stringify({ reportType, dateRange }),
    });
    if (res.data?.ok) {
      return { ok: true, success: true, message: res.data.message, exportItem: res.data.exportItem };
    }
    return { ok: false, success: false, error: res.error || 'Export generation failed' };
  },
};

// 9. Organization: Departments & Designations
export const orgService = {
  async getDepartments() {
    const res = await apiClient<any>('/departments', { method: 'GET' });
    return res.data?.data ?? [];
  },

  async createDepartment(payload: { name: string; lead?: string; code?: string; description?: string }) {
    const res = await apiClient<any>('/departments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.data?.ok) {
      return { ok: true, success: true, message: res.data.message, department: res.data.department };
    }
    return { ok: false, success: false, error: res.error || 'Failed to create department' };
  },

  async getDesignations() {
    const res = await apiClient<any>('/designations', { method: 'GET' });
    return res.data?.data ?? [];
  },

  async createDesignation(payload: { title: string; department?: string; accessLevel?: string }) {
    const res = await apiClient<any>('/designations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.data?.ok) {
      return { ok: true, success: true, message: res.data.message, designation: res.data.designation };
    }
    return { ok: false, success: false, error: res.error || 'Failed to create designation' };
  },

  async getAccessLevels() {
    const res = await apiClient<any>('/access-levels', { method: 'GET' });
    return res.data?.data ?? null;
  },

  async updatePermissions(roleOrPayload: any, moduleName?: string, accessLevel?: string) {
    const body =
      typeof roleOrPayload === 'string'
        ? { roleId: roleOrPayload, module: moduleName, access: accessLevel }
        : roleOrPayload;
    const res = await apiClient<any>('/access-levels', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    if (res.data?.ok) {
      return { ok: true, success: true, message: res.data.message };
    }
    return { ok: false, success: false, error: res.error || 'Failed to update permissions' };
  },
};

// 10. Modules & Settings
export const settingsService = {
  async getModules() {
    const res = await apiClient<any>('/modules', { method: 'GET' });
    return res.data?.data ?? [];
  },

  async toggleModule(key: string, enabled: boolean) {
    const res = await apiClient<any>('/modules', {
      method: 'PATCH',
      body: JSON.stringify({ key, enabled }),
    });
    if (res.data?.ok) {
      return { ok: true, success: true, message: res.data.message };
    }
    return { ok: false, success: false, error: res.error || res.data?.error || 'Failed to toggle module' };
  },

  async getCompanySettings() {
    const res = await apiClient<any>('/settings', { method: 'GET' });
    return res.data?.data ?? null;
  },

  async updateCompanySettings(payload: any) {
    const res = await apiClient<any>('/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (res.data?.ok) {
      return { ok: true, success: true, message: res.data.message };
    }
    return { ok: false, success: false, error: res.error || 'Failed to save settings' };
  },
};

// 11. Billing & ID Card & Documents & Audit & Account
export const featureService = {
  async getBilling() {
    const res = await apiClient<any>('/billing', { method: 'GET' });
    return res.data?.data ?? null;
  },

  async checkoutPlan(planKey: string, cadence: string = 'monthly', paymentMethod: string = 'UPI') {
    const res = await apiClient<any>('/billing', {
      method: 'POST',
      body: JSON.stringify({ planKey, cadence, paymentMethod }),
    });
    if (res.data?.ok) {
      return { ok: true, success: true, message: res.data.message, data: res.data };
    }
    return { ok: false, success: false, error: res.error || 'Checkout initiation failed' };
  },

  async getIdCardConfig() {
    const res = await apiClient<any>('/idcard', { method: 'GET' });
    return res.data?.data ?? null;
  },

  async saveIdCardConfig(payload: any) {
    const res = await apiClient<any>('/idcard', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (res.data?.ok) {
      return { ok: true, success: true, message: res.data.message };
    }
    return { ok: false, success: false, error: res.error || 'Failed to save ID Card settings' };
  },

  async getDocuments() {
    const res = await apiClient<any>('/documents', { method: 'GET' });
    return res.data?.data ?? [];
  },

  async uploadDocument(first: any, typeParam?: string, issueDate?: string) {
    const payload =
      typeof first === 'object'
        ? {
            title: first.name || first.title || first.fileName,
            type: first.type || 'ID Proof',
            issueDate: first.uploadedAt || '2026-10-04',
          }
        : { title: first, type: typeParam || 'ID Proof', issueDate };

    const res = await apiClient<any>('/documents', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.data?.ok) {
      return { ok: true, success: true, message: res.data.message, data: res.data.document ?? res.data };
    }
    return { ok: false, success: false, error: res.error || 'Failed to upload document' };
  },

  async getAuditLogs(category?: string) {
    const res = await apiClient<any>('/audit', {
      method: 'GET',
      params: { category: category || 'ALL' },
    });
    return res.data?.data ?? [];
  },

  async getAccount() {
    const res = await apiClient<any>('/account', { method: 'GET' });
    return res.data?.data ?? null;
  },

  async changePassword(currentPassword: string, newPassword: string) {
    const res = await apiClient<any>('/account', {
      method: 'PUT',
      body: JSON.stringify({ action: 'change-password', currentPassword, newPassword }),
    });
    if (res.data?.ok) {
      return { ok: true, success: true, message: res.data.message };
    }
    return { ok: false, success: false, error: res.error || res.data?.error || 'Password update failed' };
  },
};
