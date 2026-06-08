import { db } from '../config/database';
import { logger } from '../middleware/logger';
import type { Knex } from 'knex';

export interface AuditLogInput {
  entityType: string;
  entityId?: string | number | null | undefined;
  action: string;
  oldValue?: any;
  newValue?: any;
  userId?: number | null | undefined;
  ipAddress?: string | null | undefined;
  reason?: string | null | undefined;
  trx?: Knex.Transaction;
}

export class AuditLogService {
  /**
   * Securely logs a mutation or security event to the polymorphic audit_logs table.
   */
  async logEvent(input: AuditLogInput): Promise<void> {
    const queryBuilder = input.trx ? input.trx('audit_logs') : db('audit_logs');
    
    await queryBuilder.insert({
      entity_type: input.entityType,
      entity_id: input.entityId || null,
      action: input.action,
      old_value: input.oldValue ? JSON.stringify(input.oldValue) : null,
      new_value: input.newValue ? JSON.stringify(input.newValue) : null,
      user_id: input.userId || null,
      ip_address: input.ipAddress || null,
      reason: input.reason || null,
    });

    logger.info(`Audit Log: ${input.action} on ${input.entityType} ${input.entityId || ''}`, {
      userId: input.userId,
      ipAddress: input.ipAddress,
    });
  }
}

export const auditService = new AuditLogService();
