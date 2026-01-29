import React, { useState, useEffect } from 'react';
import { auditService } from '../services/auditService';
import { AuditLog } from '../types';
import { formatDate } from '../utils';
import { Shield, Search, Download } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    const fetchLogs = () => {
      setLogs([...auditService.getLogs()]);
    };
    fetchLogs();
    
    // Poll for changes just for demo purposes since we don't have real subscriptions
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Shield className="h-6 w-6 text-brand-600" />
                System Audit Trail
            </h1>
            <p className="text-slate-500 mt-2 max-w-2xl">
                Immutable record of all critical actions within the Harmony LMS platform. 
                Used for compliance verification and legal defensibility.
            </p>
        </div>
        <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Search by Actor, Action, or Target ID..." 
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
            </div>
            <select className="border border-slate-300 rounded-md py-2 px-3 text-sm bg-white">
                <option>All Actions</option>
                <option>GRADE_ENTRY</option>
                <option>MODULE_UPDATE</option>
            </select>
        </div>

        <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                    <th className="px-6 py-3 font-semibold text-slate-700">Timestamp</th>
                    <th className="px-6 py-3 font-semibold text-slate-700">Actor</th>
                    <th className="px-6 py-3 font-semibold text-slate-700">Action</th>
                    <th className="px-6 py-3 font-semibold text-slate-700">Details</th>
                    <th className="px-6 py-3 font-semibold text-slate-700">Ref ID</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {logs.length === 0 ? (
                    <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                            No logs generated yet. Try editing a module to generate an event.
                        </td>
                    </tr>
                ) : (
                    logs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-mono text-xs">
                                {formatDate(log.timestamp)}
                            </td>
                            <td className="px-6 py-4">
                                <div className="font-medium text-slate-900">{log.actorName}</div>
                                <div className="text-xs text-slate-400">{log.actorId}</div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={
                                    `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                    ${log.actionType === 'MODULE_UPDATE' ? 'bg-blue-100 text-blue-800' : ''}
                                    ${log.actionType === 'GRADE_ENTRY' ? 'bg-green-100 text-green-800' : ''}
                                    `
                                }>
                                    {log.actionType}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={log.details}>
                                {log.details}
                            </td>
                            <td className="px-6 py-4 text-slate-400 font-mono text-xs">
                                {log.targetId}
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
      </div>
    </div>
  );
};