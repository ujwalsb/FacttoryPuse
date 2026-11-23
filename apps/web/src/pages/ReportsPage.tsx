import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Layers,
  Printer,
  Table,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [productionReports, setProductionReports] = useState<any[]>([]);
  const [downtimeData, setDowntimeData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadReports() {
      try {
        const [pRes, dRes] = await Promise.all([
          api.getProductionReport(),
          api.getDowntimeReport()
        ]);
        if (pRes.success) setProductionReports(pRes.data);
        if (dRes.success) setDowntimeData(dRes.data);
      } catch (err) {
        console.error('Failed to load reports:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadReports();
  }, []);

  const handleDownloadCsv = async (type: 'production' | 'alerts') => {
    try {
      const token = api.getToken();
      const tenantHeader = user?.tenantId ? `&tenantId=${user.tenantId}` : '';
      const endpoint = type === 'production'
        ? '/api/v1/reports/export/production.csv'
        : '/api/v1/reports/export/alerts.csv';

      const response = await fetch(`${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factorypulse-${type}-report.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert('Failed to download report export');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-industrial-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 sm:h-6 sm:w-6 text-brand-400 shrink-0" />
            <span>Manufacturing Reports & Export Center</span>
          </h1>
          <p className="text-xs text-industrial-400 mt-1 font-mono">
            Audit-Grade Production Ledgers • Downtime Analysis • Real-time CSV Export
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 self-stretch sm:self-auto w-full sm:w-auto">
          <button
            onClick={() => handleDownloadCsv('production')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 sm:py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg hover:bg-brand-500 transition-all font-mono text-center"
          >
            <Download className="h-4 w-4" />
            <span>Export Production CSV</span>
          </button>
          <button
            onClick={() => handleDownloadCsv('alerts')}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-industrial-700 bg-industrial-900 px-4 py-2.5 sm:py-2 text-xs font-bold uppercase tracking-wider text-industrial-200 hover:text-white hover:border-industrial-600 transition-all font-mono text-center"
          >
            <Download className="h-4 w-4" />
            <span>Export Incidents CSV</span>
          </button>
        </div>
      </div>

      {/* Production Summary Report Table */}
      <div className="rounded-2xl border border-industrial-800 bg-industrial-900/70 p-4 sm:p-6 backdrop-blur-sm shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
            <Table className="h-4 w-4 text-brand-400" />
            Production Shift Summary Ledger
          </h3>
          <span className="font-mono text-xs text-industrial-400">
            Filtered by Tenant: {user?.tenantName || 'Current Scope'}
          </span>
        </div>

        <div className="overflow-x-auto table-scroll-container">
          <table className="w-full min-w-[750px] text-left text-xs font-mono">
            <thead className="border-b border-industrial-800 bg-industrial-950/60 text-industrial-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Shift</th>
                <th className="py-3 px-4">Asset ID</th>
                <th className="py-3 px-4">Machine Name</th>
                <th className="py-3 px-4">Good Count</th>
                <th className="py-3 px-4">Reject Count</th>
                <th className="py-3 px-4">Operating Time</th>
                <th className="py-3 px-4">Downtime</th>
                <th className="py-3 px-4">OEE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-industrial-800/60 text-industrial-300">
              {productionReports.map(r => (
                <tr key={r._id} className="hover:bg-industrial-800/30 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-white">{r.dateString}</td>
                  <td className="py-3.5 px-4">{r.shiftCode}</td>
                  <td className="py-3.5 px-4 font-bold text-brand-400">{r.machineId?.assetId}</td>
                  <td className="py-3.5 px-4 font-semibold text-white">{r.machineId?.name}</td>
                  <td className="py-3.5 px-4 text-emerald-400 font-bold">{r.goodCount.toLocaleString()}</td>
                  <td className="py-3.5 px-4 text-rose-400 font-bold">{r.rejectCount}</td>
                  <td className="py-3.5 px-4">{Math.round(r.operatingTimeMinutes)}m</td>
                  <td className="py-3.5 px-4 text-amber-400">{Math.round(r.downtimeMinutes)}m</td>
                  <td className="py-3.5 px-4 font-bold text-white bg-industrial-800/40">{r.oee}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Downtime & Fault Frequency Breakdown */}
      {downtimeData && (
        <div className="rounded-2xl border border-industrial-800 bg-industrial-900/70 p-4 sm:p-6 backdrop-blur-sm shadow-xl space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            Downtime Pareto & Fault Code Distribution
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {downtimeData.faultBreakdown?.map((fb: any, idx: number) => (
              <div
                key={idx}
                className="rounded-xl border border-industrial-800 bg-industrial-950/60 p-4 font-mono text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-400 text-sm">{fb._id}</span>
                  <span className="px-2 py-0.5 rounded bg-industrial-900 text-industrial-300 font-bold">
                    {fb.count} occurrences
                  </span>
                </div>
                <p className="text-[11px] text-industrial-400">
                  {fb.latestTitle}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
