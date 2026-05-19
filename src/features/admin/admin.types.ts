export type AuditAction =
  | "BOOK_ADD"
  | "BOOK_EDIT"
  | "BOOK_DELETE"
  | "BORROW_APPROVE"
  | "BORROW_REJECT"
  | "MEMBER_APPOINT"
  | "FINE_COLLECT"
  | "SECURITY_LOGIN_FAILURE";

export type AuditSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface SecurityAuditResult {
  rls_missing: string[];
  permissive_policies: Array<{
    table: string;
    policy: string;
    cmd: string;
  }>;
  sensitive_public_read: string[];
  status: "SECURE" | "RISK";
  timestamp: string;
}

export interface SecurityAlert {
  id: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  timestamp: string;
  resolved: boolean;
}

export interface LibraryReport {
  id: string;
  type: string;
  data: any;
  created_at: string;
}

export interface LogisticsTask {
  id: string;
  type: "TRANSFER" | "RESTOCK";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  priority: "LOW" | "MEDIUM" | "HIGH";
  metadata: any;
}

export interface MonthlyReportData {
  month: string;
  borrowCount: number;
  returnCount: number;
  fineRevenue: number;
  activeUsers: number;
}

export interface BranchStock {
  branch_id: string;
  book_isbn: string;
  total_copies: number;
  available_copies: number;
  branches?: {
    name: string;
    location: string;
  };
  books?: {
    title: string;
  };
}

export type UserRole = "MEMBER" | "LIBRARIAN" | "ADMIN";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  isLocked: boolean;
  isSuperAdmin: boolean;
  xp?: number;
  level?: number;
  created_at?: string;
}

export interface RedistributionSuggestion {
  book_isbn: string;
  book_title: string;
  from_branch_id: string;
  from_branch_name: string;
  to_branch_id: string;
  to_branch_name: string;
  quantity: number;
  reason: string;
  confidence: number;
}
