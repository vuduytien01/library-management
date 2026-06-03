import { persistence } from "../../core/persistence";
import { mediaCache } from "../../core/mediaCache";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "../../api/supabase";
import {
  Annotation,
  BorrowRecord,
  DownloadedFile,
  SystemConfig,
} from "./members.types";

export const membersService = {
  // --- System & Borrowing ---
  async getSystemConfig(): Promise<SystemConfig> {
    const { data, error } = await supabase.from("system_config").select("*");
    if (error) console.warn("[membersService] Config error:", error.message);

    const configMap = (data || []).reduce((acc: any, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {});

    return {
      fine_rate: parseInt(configMap.fine_rate || "2000", 10),
      member_due_days: parseInt(configMap.member_due_days || "14", 10),
      admin_due_days: parseInt(configMap.admin_due_days || "30", 10),
      max_books: parseInt(configMap.max_books || "5", 10),
    };
  },

  async updateSystemConfig(key: string, value: string): Promise<void> {
    const { error } = await supabase
      .from("system_config")
      .upsert({ key, value });
    if (error) throw error;
  },

  async getMyBorrows(userId: string): Promise<BorrowRecord[]> {
    const { data, error } = await supabase
      .from("borrow_records")
      .select("*, book:books(*)")
      .eq("user_id", userId)
      .order("borrowed_at", { ascending: false });
    if (error) throw error;

    const records = (data || []).map((record) => {
      if (
        record.status === "BORROWED" &&
        record.due_date &&
        new Date(record.due_date) < new Date()
      ) {
        const daysLate = Math.floor(
          (new Date().getTime() - new Date(record.due_date).getTime()) /
            (1000 * 3600 * 24),
        );
        return { ...record, estimated_fine: Math.max(0, daysLate * 2000) };
      }
      return { ...record, estimated_fine: 0 };
    });

    await this.saveBorrows(records);
    return records as BorrowRecord[];
  },

  async borrowBook(isbn: string, branchId: string) {
    try {
      const { data, error } = await supabase.rpc("borrow_book_v2", {
        p_isbn: isbn,
        p_branch_id: branchId,
      });
      if (error) throw error;
      
      // Handle logical failures from RPC
      if (data && data.success === false) {
        throw new Error(data.message || "Borrowing failed");
      }
      
      return data;
    } catch (err: any) {
      if (err.message === "Failed to fetch" || !err.status) {
        await this.queueAction("BORROW", { isbn, branchId });
        return { success: true, queued: true };
      }
      throw err;
    }
  },

  async payFine(recordId: string, method: string) {
    const { data, error } = await supabase.rpc("pay_fine", {
      p_record_id: recordId,
      p_method: method,
    });
    if (error) throw error;
    return data;
  },

  calculateLateFine(
    dueDate: string,
    returnDate: string,
    fineRate: number,
  ): number {
    const due = new Date(dueDate);
    const returned = new Date(returnDate);
    due.setHours(0, 0, 0, 0);
    returned.setHours(0, 0, 0, 0);
    if (returned <= due) return 0;
    const diffDays = Math.ceil(
      Math.abs(returned.getTime() - due.getTime()) / (1000 * 60 * 60 * 24),
    );
    return diffDays * fineRate;
  },

  async processBookReturn(isbn: string, librarianId: string) {
    const { data: record, error: findError } = await supabase
      .from("borrow_records")
      .select("*, book:books(*)")
      .eq("status", "BORROWED")
      .eq("book_id", isbn)
      .maybeSingle();

    if (findError || !record) throw new Error("No active borrow record found");

    const config = await this.getSystemConfig();
    const returnDate = new Date().toISOString();
    const lateFine = this.calculateLateFine(
      record.due_date,
      returnDate,
      config.fine_rate,
    );

    const { data, error: returnError } = await supabase.rpc(
      "return_book_by_isbn",
      {
        p_isbn: isbn,
        p_librarian_id: librarianId,
        p_late_fine: lateFine,
      },
    );

    if (returnError) throw returnError;

    if (lateFine === 0) {
      await this.addXP(50, record.user_id);
    }

    return { ...data, late_fine: lateFine, is_overdue: lateFine > 0 };
  },

  // --- Gamification ---
  calculateLevel: (xp: number) => Math.floor(xp / 100) + 1,

  async getAllBadges() {
    const { data, error } = await supabase
      .from("badges")
      .select("*")
      .order("threshold_value", { ascending: true });
    if (error) throw error;
    return data;
  },

  async getMyBadges(userId: string) {
    if (!userId) return [];
    const { data, error } = await supabase
      .from("user_badges")
      .select("earned_at, badges(*)")
      .eq("user_id", userId);
    if (error) return [];
    return data.map((item: any) => ({
      ...item.badges,
      earnedAt: item.earned_at,
    }));
  },

  async getLeaderboard(limit = 50) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, fullName:full_name, avatarUrl:avatar_url, xp, level, role")
      .order("xp", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).map((u: any) => ({
      id: u.id,
      fullName: u.fullName,
      avatarUrl: u.avatarUrl,
      xp: u.xp,
      level: u.level,
      role: u.role,
    }));
  },

  async addXP(
    amount: number,
    userId: string,
    p_currentXP?: number,
    p_currentLevel?: number,
  ) {
    if (!userId) return;

    let currentXP = p_currentXP;
    let currentLevel = p_currentLevel;

    if (currentXP === undefined || currentLevel === undefined) {
      const { data } = await supabase
        .from("profiles")
        .select("xp, level")
        .eq("id", userId)
        .single();
      currentXP = data?.xp || 0;
      currentLevel = data?.level || 1;
    }

    const newXP = (currentXP || 0) + amount;
    const newLevel = this.calculateLevel(newXP);

    const { error } = await supabase
      .from("profiles")
      .update({ xp: newXP, level: newLevel })
      .eq("id", userId);

    if (error) throw error;

    return { newXP, newLevel, leveledUp: newLevel > (currentLevel || 1) };
  },

  // --- Offline & Downloads ---
  async saveProfile(profile: any) {
    await persistence.saveProfile(profile);
  },
  async getProfile() {
    return await persistence.getProfile();
  },

  async saveBorrows(records: any[]) {
    await persistence.saveItem("BIBLIO_OFFLINE_BORROWS", records);
  },
  async getBorrows() {
    return (await persistence.getItem("BIBLIO_OFFLINE_BORROWS")) || [];
  },

  async saveBooks(books: any[]) {
    const slimBooks = books.slice(0, 250).map((book) => ({
      isbn: book.isbn,
      title: book.title,
      title_vi: book.title_vi,
      title_en: book.title_en,
      author: book.author,
      author_vi: book.author_vi,
      author_en: book.author_en,
      category: book.category,
      cover_url: book.cover_url,
      thumbnail: book.thumbnail,
      description: book.description,
      total_copies: book.total_copies,
      available_copies: book.available_copies,
    }));
    await persistence.saveItem("BIBLIO_OFFLINE_BOOKS", slimBooks);
  },
  async getBooks() {
    return (await persistence.getItem("BIBLIO_OFFLINE_BOOKS")) || [];
  },

  async clearAll() {
    await Promise.all([persistence.clearAllAuth(), mediaCache.clearAll()]);
  },

  async downloadFile(
    id: string,
    title: string,
    url: string,
    type: "EPUB" | "MP3",
    onProgress?: (p: number) => void,
  ): Promise<DownloadedFile> {
    const localPath = `${(FileSystem as any).documentDirectory}${id}_${Date.now()}.${type.toLowerCase()}`;
    const download = FileSystem.createDownloadResumable(
      url,
      localPath,
      {},
      (p) => {
        if (onProgress)
          onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
      },
    );
    const result = await download.downloadAsync();
    if (!result) throw new Error("Download failed");

    const downloads =
      (await persistence.getItem("BIBLIO_OFFLINE_DOWNLOADS")) || [];
    const newDownload: DownloadedFile = {
      id,
      title,
      type,
      uri: result.uri,
      downloaded_at: new Date().toISOString(),
    };
    await persistence.saveItem("BIBLIO_OFFLINE_DOWNLOADS", [
      ...downloads,
      newDownload,
    ]);
    return newDownload;
  },

  async getDownloads(): Promise<DownloadedFile[]> {
    return (await persistence.getItem("BIBLIO_OFFLINE_DOWNLOADS")) || [];
  },

  async getLocalUri(id: string): Promise<string | null> {
    const downloads =
      (await persistence.getItem("BIBLIO_OFFLINE_DOWNLOADS")) || [];
    const file = downloads.find((d: DownloadedFile) => d.id === id);
    return file ? file.uri : null;
  },

  async deleteDownload(id: string) {
    const downloads =
      (await persistence.getItem("BIBLIO_OFFLINE_DOWNLOADS")) || [];
    const file = downloads.find((d: DownloadedFile) => d.id === id);
    if (file) {
      try {
        await FileSystem.deleteAsync(file.uri);
      } catch (e) {}
    }
    const updated = downloads.filter((d: DownloadedFile) => d.id !== id);
    await persistence.saveItem("BIBLIO_OFFLINE_DOWNLOADS", updated);
  },

  async queueAction(type: string, payload: any) {
    const queue = await this.getActionQueue();
    await persistence.saveItem("BIBLIO_OFFLINE_ACTION_QUEUE", [
      ...queue,
      { id: Date.now().toString(), type, payload, timestamp: Date.now() },
    ]);
  },

  async getActionQueue() {
    return (await persistence.getItem("BIBLIO_OFFLINE_ACTION_QUEUE")) || [];
  },
  async clearActionQueue() {
    await persistence.saveItem("BIBLIO_OFFLINE_ACTION_QUEUE", []);
  },

  async processQueue() {
    const queue = await this.getActionQueue();
    if (queue.length === 0) return;

    for (const action of queue) {
      try {
        if (action.type === "BORROW") {
          await this.borrowBook(action.payload.isbn, action.payload.branchId);
        } else if (action.type === "LIKE" || action.type === "BOOKMARK") {
          await this.toggleInteraction(
            action.payload.userId,
            action.payload.itemId,
            action.payload.itemType,
            action.type,
            false,
          );
        }
      } catch (e) {
        console.warn(
          `[membersService] Failed to process action ${action.id}:`,
          e,
        );
      }
    }
    await this.clearActionQueue();
  },

  // --- Annotations ---
  async getAnnotationsByBook(isbn: string) {
    const { data, error } = await supabase
      .from("annotations")
      .select("*, profiles:user_id(fullName:full_name, avatarUrl:avatar_url)")
      .eq("book_isbn", isbn)
      .order("created_at", { ascending: false });
    if (error) throw error;

    return (data || []).map((ann: any) => ({
      ...ann,
      profiles: ann.profiles
        ? {
            fullName: ann.profiles.fullName,
            avatarUrl: ann.profiles.avatarUrl,
          }
        : null,
      user: ann.profiles
        ? {
            fullName: ann.profiles.fullName,
            avatarUrl: ann.profiles.avatarUrl,
          }
        : null,
    }));
  },

  async createAnnotation(annotation: any) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");
    const { data, error } = await supabase
      .from("annotations")
      .insert({ ...annotation, user_id: user.id })
      .select()
      .single();
    if (error) throw error;
    return data as Annotation;
  },

  async deleteAnnotation(id: string) {
    const { error } = await supabase.from("annotations").delete().eq("id", id);
    if (error) throw error;
  },

  // --- Social & Interactions ---
  async getInteractions(userId: string, itemId: string, itemType: string) {
    const { data, error } = await supabase
      .from("user_interactions")
      .select("*")
      .eq("user_id", userId)
      .eq("item_id", String(itemId))
      .eq("item_type", itemType);
    if (error) throw error;
    return data || [];
  },

  async toggleInteraction(
    userId: string,
    itemId: string,
    itemType: "BOOK" | "AUDIOBOOK",
    type: "LIKE" | "BOOKMARK" | "COMPLETED",
    currentState: boolean,
  ) {
    console.log(
      `[membersService] toggleInteraction: userId=${userId}, itemId=${itemId}, itemType=${itemType}, type=${type}, currentState=${currentState}`,
    );

    if (!userId || userId === "undefined" || userId === null) return;
    if (!itemId) return;

    try {
      // Check current database state to ensure we are in sync
      const { data: existing } = await supabase
        .from("user_interactions")
        .select("id")
        .eq("user_id", userId)
        .eq("item_id", String(itemId))
        .eq("item_type", itemType)
        .eq("interaction_type", type)
        .maybeSingle();

      if (existing) {
        // If it exists, we always remove it when toggling, regardless of what frontend thought
        console.log(`[membersService] Removing existing ${type}`);
        const { error } = await supabase
          .from("user_interactions")
          .delete()
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // If it doesn't exist, we add it
        console.log(`[membersService] Adding new ${type}`);
        const { error } = await supabase.from("user_interactions").insert({
          user_id: userId,
          item_id: String(itemId),
          item_type: itemType,
          interaction_type: type,
        });

        if (error) throw error;
      }
    } catch (err: any) {
      console.error(`[membersService] toggleInteraction exception:`, err);
      if (err.message === "Failed to fetch" || !err.status) {
        console.warn(`[membersService] Network error, queuing action ${type}`);
        await this.queueAction(type, { userId, itemId, itemType });
      } else {
        throw err;
      }
    }
  },
};
