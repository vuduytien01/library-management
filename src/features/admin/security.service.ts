import { supabase } from "../../api/supabase";

export interface SecurityAuditResult {
  status: "SECURE" | "RISK";
  timestamp: string;
  rls_missing: string[];
  permissive_policies: Array<{
    table: string;
    policy: string;
    cmd: string;
  }>;
  sensitive_public_read: string[];
}

export const securityService = {
  /**
   * Runs a comprehensive security audit on the Supabase database.
   * Checks for:
   * 1. Tables missing Row-Level Security (RLS)
   * 2. Overly permissive policies (e.g., using 'true' instead of auth checks)
   * 3. Public access to sensitive tables
   */
  async runAudit(): Promise<SecurityAuditResult> {
    const results: SecurityAuditResult = {
      status: "SECURE",
      timestamp: new Date().toISOString(),
      rls_missing: [],
      permissive_policies: [],
      sensitive_public_read: [],
    };

    try {
      // 1. Check for tables missing RLS
      const { data: rlsData, error: rlsError } =
        await supabase.rpc("check_rls_status");
      if (!rlsError && rlsData) {
        results.rls_missing = rlsData
          .filter((t: any) => !t.is_rls_enabled)
          .map((t: any) => t.relname);
      }

      // 2. Check for permissive policies
      const { data: policyData, error: policyError } = await supabase.rpc(
        "check_permissive_policies",
      );
      if (!policyError && policyData) {
        results.permissive_policies = policyData.map((p: any) => ({
          table: p.tablename,
          policy: p.policyname,
          cmd: p.cmd,
        }));
      }

      // 3. Check for sensitive tables with public access
      const sensitiveTables = [
        "profiles",
        "audit_logs",
        "borrow_records",
        "transactions",
      ];
      const { data: publicData, error: publicError } = await supabase.rpc(
        "check_public_access",
      );
      if (!publicError && publicData) {
        results.sensitive_public_read = publicData
          .filter((t: any) => sensitiveTables.includes(t.tablename))
          .map((t: any) => t.tablename);
      }

      // Update overall status
      if (
        results.rls_missing.length > 0 ||
        results.permissive_policies.length > 0 ||
        results.sensitive_public_read.length > 0
      ) {
        results.status = "RISK";
      }

      return results;
    } catch (error) {
      console.error("[securityService] Audit failed:", error);
      throw error;
    }
  },

  async getAuditLogs(limit = 50) {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*, profiles:actor_id(fullName:full_name)")
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  },
};
