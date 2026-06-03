import { supabase } from '../api/supabase';

export interface AuditLog {
  id: string;
  actor_id: string;
  action_type: string;
  target_id: string | null;
  metadata: any;
  severity: string;
  created_at: string;
  actor?: {
    fullName: string;
    role: string;
  };
}

export const auditService = {
  async getLogs(limit: number = 100): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*, actor:profiles!actor_id(fullName:full_name, role)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[AuditService] Error fetching logs:', error.message);
      return [];
    }

    return data as AuditLog[];
  },

  async log(entry: {
    actorId: string;
    action: string;
    targetId?: string;
    metadata?: any;
    severity?: string;
  }) {
    const { error } = await supabase.from('audit_logs').insert({
      actor_id: entry.actorId,
      action_type: entry.action,
      target_id: entry.targetId || null,
      metadata: entry.metadata || {},
      severity: entry.severity || 'INFO',
    });

    if (error) {
      console.error('[AuditService] Error creating log:', error.message);
    }
  }
};
