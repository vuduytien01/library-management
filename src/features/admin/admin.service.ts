import { supabase } from "../../api/supabase";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { Platform } from "react-native";
import { ai } from "../../core/ai";
import {
  AuditAction,
  AuditSeverity,
  SecurityAlert,
  MonthlyReportData,
  BranchStock,
  RedistributionSuggestion,
  LogisticsTask,
  LibraryReport,
  SecurityAuditResult,
} from "./admin.types";
import { securityService } from "./security.service";

export const adminService = {
  // --- Audit & Security ---
  async log(entry: {
    actorId: string;
    action: AuditAction | string;
    targetId?: string;
    metadata?: Record<string, any>;
    severity?: AuditSeverity | string;
  }) {
    const { error } = await supabase.from("audit_logs").insert({
      actor_id: entry.actorId,
      action_type: entry.action,
      target_id: entry.targetId,
      metadata: entry.metadata || {},
      severity: entry.severity || "INFO",
      timestamp: new Date().toISOString(),
    });
    if (error) console.error("[adminService] Audit log error:", error.message);
  },

  async getSecurityAlerts(): Promise<SecurityAlert[]> {
    const { data, error } = await supabase
      .from("security_alerts")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data || [];
  },

  async runSecurityAudit(): Promise<SecurityAuditResult> {
    return await securityService.runAudit();
  },

  // --- Borrows Management ---
  async getAllBorrows() {
    const { data, error } = await supabase
      .from("borrow_records")
      .select(
        "*, book:books(*), profiles:user_id(fullName:full_name, avatarUrl:avatar_url, email)",
      )
      .order("borrowed_at", { ascending: false });
    if (error) throw error;

    return (data || []).map((record: any) => ({
      ...record,
      fullName: record.profiles?.fullName,
      avatarUrl: record.profiles?.avatarUrl,
      email: record.profiles?.email,
      user: record.profiles
        ? {
            fullName: record.profiles.fullName,
            avatarUrl: record.profiles.avatarUrl,
            email: record.profiles.email,
          }
        : null,
    }));
  },

  async approveBorrow(recordId: string, librarianId: string) {
    const { data, error } = await supabase.rpc("approve_borrow", {
      p_record_id: recordId,
      p_librarian_id: librarianId,
    });
    if (error) throw error;

    await this.log({
      actorId: librarianId,
      action: "BORROW_APPROVE",
      targetId: recordId,
    });

    return data;
  },

  async rejectBorrow(recordId: string, librarianId: string, reason: string) {
    const { data, error } = await supabase.rpc("reject_borrow", {
      p_record_id: recordId,
      p_librarian_id: librarianId,
      p_reason: reason,
    });
    if (error) throw error;

    await this.log({
      actorId: librarianId,
      action: "BORROW_REJECT",
      targetId: recordId,
      metadata: { reason },
    });

    return data;
  },

  // --- Reports & Analytics ---
  async generateReport(
    type: "BORROWING" | "INVENTORY" | "FINANCIAL",
  ): Promise<LibraryReport> {
    const { data, error } = await supabase.rpc("generate_library_report", {
      report_type: type,
    });
    if (error) throw error;
    return data;
  },

  async getAnalytics(timeRange: string) {
    const { data, error } = await supabase.rpc("get_library_analytics", {
      range: timeRange,
    });
    if (error) throw error;
    return data;
  },

  async getMonthlyStats(month: string): Promise<MonthlyReportData> {
    const startDate = `${month}-01T00:00:00Z`;
    const endDate = new Date(
      new Date(startDate).setMonth(new Date(startDate).getMonth() + 1),
    ).toISOString();

    const { data: borrows } = await supabase
      .from("borrow_records")
      .select("*")
      .gte("created_at", startDate)
      .lt("created_at", endDate);
    const { data: transactions } = await supabase
      .from("transactions")
      .select("amount")
      .eq("status", "PAID")
      .gte("created_at", startDate)
      .lt("created_at", endDate);

    return {
      month,
      borrowCount: borrows?.length || 0,
      returnCount: borrows?.filter((b) => b.status === "RETURNED").length || 0,
      fineRevenue:
        transactions?.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0,
      activeUsers: new Set(borrows?.map((b) => b.user_id)).size,
    };
  },

  async exportReportToCSV(data: MonthlyReportData) {
    const csv = `Month,Borrows,Returns,Revenue,Users\n${data.month},${data.borrowCount},${data.returnCount},${data.fineRevenue},${data.activeUsers}`;
    const fileName = `Report_${data.month}.csv`;
    if (Platform.OS === "web") {
      const url = window.URL.createObjectURL(
        new Blob([csv], { type: "text/csv" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
    } else {
      const fileUri = `${(FileSystem as any).documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, csv);
      await Sharing.shareAsync(fileUri);
    }
  },

  async exportReportToPDF(data: MonthlyReportData, lang: string = "vi") {
    const title = lang === "vi" ? "Báo cáo BiblioTech" : "BiblioTech Report";
    const borrowsLabel = lang === "vi" ? "Số lượt mượn" : "Borrows";
    const html = `<html><body><h1>${title}: ${data.month}</h1><p>${borrowsLabel}: ${data.borrowCount}</p></body></html>`;
    const { uri } = await Print.printToFileAsync({ html });
    if (Platform.OS === "web") window.open(uri, "_blank");
    else await Sharing.shareAsync(uri);
  },

  // --- Logistics & Inventory ---
  async getBranchStock(bookIsbn: string) {
    const { data, error } = await supabase
      .from("branch_inventory")
      .select("*, branches(name, location)")
      .eq("book_isbn", bookIsbn);
    if (error) throw error;
    return data;
  },

  async getAIRedistributionSuggestions(
    lang: string = "vi",
  ): Promise<RedistributionSuggestion[]> {
    try {
      const { data: inventory } = await supabase
        .from("branch_inventory")
        .select("*, branches(name), books(title)");
      const { data: heatmap } = await supabase
        .from("branch_borrow_heatmap")
        .select("*");

      const langName = lang === "vi" ? "tiếng Việt" : "English";
      const prompt = `Inventory analysis: ${JSON.stringify(inventory?.slice(0, 50))} and Demand: ${JSON.stringify(heatmap?.slice(0, 50))}. Suggest 5 transfers in JSON with fields: isbn, fromBranchId, toBranchId, quantity, reason, priority. Please write the reason in ${langName}.`;

      return await ai.analyzeLogistics(prompt);
    } catch (e) {
      return [];
    }
  },

  async executeTransfer(
    isbn: string,
    fromBranchId: string,
    toBranchId: string,
    quantity: number,
    userId: string,
  ) {
    const { data, error } = await supabase.rpc("transfer_inventory", {
      p_book_isbn: isbn,
      p_from_branch_id: fromBranchId,
      p_to_branch_id: toBranchId,
      p_qty: quantity,
      p_user_id: userId,
    });
    if (error) throw error;
    return data;
  },

  async getAllTransfers() {
    const { data, error } = await supabase
      .from("inventory_transfers")
      .select(
        "*, book:books(title), from_branch:branches!from_branch_id(name), to_branch:branches!to_branch_id(name)",
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async completeTransfer(transferId: string) {
    const { data, error } = await supabase.rpc("complete_transfer", {
      p_transfer_id: transferId,
    });
    if (error) throw error;
    return data;
  },

  async updateTransferStatus(
    transferId: string,
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED",
  ) {
    const { error } = await supabase
      .from("inventory_transfers")
      .update({ status })
      .eq("id", transferId);
    if (error) throw error;
  },

  async searchMembers(query: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, fullName:full_name, avatarUrl:avatar_url, role, xp, level, email",
      )
      .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(10);
    if (error) throw error;

    return (data || []).map((p: any) => ({
      ...p,
      fullName: p.fullName,
      avatarUrl: p.avatarUrl,
    }));
  },

  // --- System Maintenance ---
  async backfillEmbeddings() {
    const { data, error } = await supabase.functions.invoke(
      "backfill-embeddings",
      {
        method: "POST",
      },
    );
    if (error) throw error;
    return data;
  },

  // --- User Management (Edge Functions) ---
  async listUsers() {
    const { data, error } = await supabase.functions.invoke(
      "admin-manager/list-users",
      {
        method: "GET",
      },
    );
    if (error) throw error;

    // Map snake_case to camelCase for UI consistency
    return (data || []).map((user: any) => ({
      ...user,
      fullName: user.full_name,
      avatarUrl: user.avatar_url,
      isLocked: user.is_locked,
      profileIsLocked: user.profile_is_locked,
      authBannedUntil: user.auth_banned_until,
      authIsBanned: user.auth_is_banned,
      isSuperAdmin: user.is_super_admin,
    }));
  },

  async createUser(userData: any) {
    const { data, error } = await supabase.functions.invoke(
      "admin-manager/create-user",
      {
        method: "POST",
        body: {
          email: userData.email,
          password: userData.password,
          fullName: userData.fullName,
          role: userData.role,
        },
      },
    );
    if (error) throw error;
    return data;
  },

  async updateUser(userId: string, userData: any) {
    const { data, error } = await supabase.functions.invoke(
      "admin-manager/update-user",
      {
        method: "PUT",
        body: {
          id: userId,
          fullName: userData.fullName,
          role: userData.role,
          isLocked: userData.isLocked,
        },
      },
    );
    if (error) throw error;

    // Log the change if we have an actorId
    if (userData.actorId) {
      await this.log({
        actorId: userData.actorId,
        action: "USER_UPDATE",
        targetId: userId,
        metadata: {
          updatedFields: Object.keys(userData).filter((k) => k !== "actorId"),
          ...userData,
        },
        severity: "INFO",
      });
    }

    // Map result if available
    if (data?.user) {
      return {
        ...data.user,
        fullName: data.user.full_name,
        avatarUrl: data.user.avatar_url,
        isLocked: data.user.is_locked,
        profileIsLocked: data.user.profile_is_locked,
        authBannedUntil: data.user.auth_banned_until,
        authIsBanned: data.user.auth_is_banned,
      };
    }
    return data;
  },

  async unlockUser(userId: string, actorId?: string) {
    return this.updateUser(userId, { isLocked: false, actorId });
  },

  async deleteUser(userId: string, actorId?: string) {
    const { data, error } = await supabase.functions.invoke(
      "admin-manager/delete-user",
      {
        method: "DELETE",
        body: { userId },
      },
    );
    if (error) throw error;

    if (actorId) {
      await this.log({
        actorId,
        action: "USER_DELETE",
        targetId: userId,
        severity: "WARNING",
      });
    }

    return data;
  },
};
