import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { ScrollText, Shield, User, Globe, Clock, Filter } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      try {
        const res = await api.getAuditLogs({ limit: '100' });
        if (res.success) setLogs(res.data);
      } catch (err) {
        console.error('Failed to load audit logs:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-industrial-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
            <ScrollText className="h-5 w-5 sm:h-6 sm:w-6 text-brand-400 shrink-0" />
            <span>Immutable Compliance & Security Audit Trail</span>
          </h1>
          <p className="text-xs text-industrial-400 mt-1 font-mono">
            Cryptographic Event Signatures • IEC 62443 Traceability • Tamper-Resistant Ledger
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-industrial-800 bg-industrial-900/70 p-4 sm:p-6 backdrop-blur-sm shadow-xl space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
          Security & Command Log Records ({logs.length})
        </h3>

        <div className="overflow-x-auto table-scroll-container">
          <table className="w-full min-w-[720px] text-left text-xs font-mono">
            <thead className="border-b border-industrial-800 bg-industrial-950/60 text-industrial-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Audit Action</th>
                <th className="py-3 px-4">Resource Target</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Event Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-industrial-800/60 text-industrial-300">
              {logs.map(log => (
                <tr key={log._id} className="hover:bg-industrial-800/30 transition-colors">
                  <td className="py-3 px-4 text-industrial-400 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-semibold text-white">
                    {log.actorEmail}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-industrial-800 border border-industrial-700 font-bold text-brand-300">
                      {log.actorRole}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-emerald-400">
                    {log.action}
                  </td>
                  <td className="py-3 px-4 text-industrial-300">
                    {log.resourceType}: <span className="text-industrial-500">{log.resourceId}</span>
                  </td>
                  <td className="py-3 px-4 text-industrial-400">
                    {log.ipAddress}
                  </td>
                  <td className="py-3 px-4 text-industrial-400 max-w-xs truncate">
                    {log.details ? JSON.stringify(log.details) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
