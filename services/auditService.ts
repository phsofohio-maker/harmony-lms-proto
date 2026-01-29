import { AuditLog } from '../types';
import { generateId } from '../utils';

class AuditService {
  private logs: AuditLog[] = [];

  logAction(actorId: string, actorName: string, actionType: AuditLog['actionType'], targetId: string, details: string) {
    const log: AuditLog = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      actorId,
      actorName,
      actionType,
      targetId,
      details
    };
    
    // In a real app, this writes to Firestore 'audit_logs' collection
    this.logs.unshift(log);
    console.group('%c 🛡️ AUDIT LOG CREATED', 'color: #16a34a; font-weight: bold;');
    console.log('Action:', actionType);
    console.log('Actor:', actorName);
    console.log('Details:', details);
    console.groupEnd();
  }

  getLogs(): AuditLog[] {
    return this.logs;
  }
}

export const auditService = new AuditService();