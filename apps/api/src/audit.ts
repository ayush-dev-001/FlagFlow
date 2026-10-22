import type { AuditAction, Prisma } from './generated/prisma/client.js';

export interface AuditEntry {
  orgId: string;
  actorId: string | null;
  action: AuditAction;
  flagId?: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
}

/** Writes an audit row. Pass the transaction client so the row commits or rolls back with the change. */
export function audit(tx: Prisma.TransactionClient, entry: AuditEntry) {
  return tx.auditLog.create({ data: { ...entry, metadata: entry.metadata ?? {} } });
}
