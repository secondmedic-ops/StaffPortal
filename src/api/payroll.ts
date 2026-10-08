import { supabase } from '../lib/supabase';
import type {
  SalaryStructure,
  Payslip,
  PayslipAccessLog,
  PayrollRun,
  SalaryAccessLog,
  MonthlyAttendanceSummary
} from '../types';

async function invokePayroll(action: string, args: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke('payroll', {
    body: { action, ...args }
  });

  if (error) {
    if (error.status === 403 || error.message?.includes('403') || error.context?.status === 403) {
      throw new Error('You do not have access to payroll data');
    }
    throw new Error(`Payroll: ${error.message}`);
  }

  return data;
}

export const payrollApi = {
  assertAccountsRole() {
    // Role is strictly enforced by the backend Edge Function via JWT
  },

  async getPayrollDashboardStatus(month: number, year: number): Promise<{
    month: number;
    year: number;
    isLockedByHr: boolean;
    lockedBy?: string;
    lockedAt?: string;
    totalHeadcount: number;
    totalLopDays: number;
    totalGrossPayroll: number;
    totalNetPayroll: number;
    publishedCount: number;
  }> {
    return await invokePayroll('dashboardStatus', { month, year });
  },

  async getSalaryStructures(): Promise<SalaryStructure[]> {
    const data = await invokePayroll('getStructures');
    return data ?? [];
  },

  async updateSalaryStructure(employeeId: number, data: {
    basic: number;
    hra: number;
    specialAllowance: number;
    providentFund: number;
    professionalTax: number;
    tds: number;
    effectiveFrom: string;
  }): Promise<SalaryStructure> {
    return await invokePayroll('upsertStructure', { employeeId, ...data });
  },

  async getLopSummary(month: number, year: number): Promise<MonthlyAttendanceSummary[]> {
    const data = await invokePayroll('getLopSummary', { month, year });
    return data ?? [];
  },

  async generatePayslips(month: number, year: number, employeeIds: number[]): Promise<Payslip[]> {
    const data = await invokePayroll('generate', { month, year, employeeIds });
    return data ?? [];
  },

  async bulkUploadPayslips(files: { name: string; size: number }[], month: number, year: number): Promise<{
    matched: Array<{ fileName: string; employeeCode: string; employeeName: string }>;
    unmatched: Array<{ fileName: string; reason: string }>;
  }> {
    return await invokePayroll('bulkUpload', { files, month, year });
  },

  async publishPayslips(month: number, year: number): Promise<{ publishedCount: number }> {
    return await invokePayroll('publish', { month, year });
  },

  async revokePayslip(payslipId: number, reason: string): Promise<void> {
    await invokePayroll('revoke', { payslipId, reason });
  },

  async getPayslipsForMonth(month: number, year: number): Promise<Payslip[]> {
    const data = await invokePayroll('listMonth', { month, year });
    return data ?? [];
  },

  async getAccessLogs(): Promise<PayslipAccessLog[]> {
    const data = await invokePayroll('accessLog');
    return data ?? [];
  }
};

export const accountsApi = {
  assertAccountsRole: payrollApi.assertAccountsRole.bind(payrollApi),

  async getPayrollRuns(year = 2026): Promise<PayrollRun[]> {
    const data = await invokePayroll('getPayrollRuns', { year });
    return data ?? [];
  },

  async executePayrollRun(month: number, year: number): Promise<PayrollRun> {
    return await invokePayroll('executeRun', { month, year });
  },

  async publishPayroll(runId: number): Promise<void> {
    await invokePayroll('publishRun', { runId });
  },

  async getSalaryStructures(): Promise<SalaryStructure[]> {
    const data = await invokePayroll('getStructures');
    return (data ?? []).map((s: any) => ({
      ...s,
      annualCtc: s.annualCtc || (s.grossSalary ? s.grossSalary * 12 : 0)
    }));
  },

  async updateSalaryStructure(employeeId: number, data: Partial<SalaryStructure>): Promise<SalaryStructure> {
    return await invokePayroll('upsertStructure', { employeeId, ...data });
  },

  async getAllPayslips(month: number, year: number): Promise<Payslip[]> {
    const data = await invokePayroll('listMonth', { month, year });
    return data ?? [];
  },

  async uploadBulkPayslips(month: number, year: number, files: File[]): Promise<any> {
    const filePayloads = files.map(f => ({ name: f.name, size: f.size }));
    return await payrollApi.bulkUploadPayslips(filePayloads, month, year);
  },

  async getSalaryAccessLogs(): Promise<SalaryAccessLog[]> {
    const data = await invokePayroll('accessLog');
    return (data ?? []).map((l: any) => ({
      id: l.id,
      timestamp: l.timestamp ?? l.accessed_at ?? l.accessedAt,
      action: l.action === 'VIEW' ? 'VIEW_PAYSLIP' : l.action === 'REVOKE' ? 'REVOKE_PAYSLIP' : 'EXPORT_REPORT',
      performedByName: l.performedByName ?? l.accessor_name ?? l.accessorName,
      performedByRole: l.performedByRole ?? l.accessor_role ?? l.accessorRole,
      targetEmployeeName: l.targetEmployeeName ?? l.employee_name ?? l.employeeName,
      ipAddress: l.ipAddress ?? l.ip_address ?? '',
      hashSeal: l.hashSeal ?? (l.id ? `sha256:seal-${l.id}` : undefined)
    }));
  }
};
