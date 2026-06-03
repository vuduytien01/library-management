// Deno type definitions are provided by deno.d.ts in the functions root

import { createClient } from "@supabase/supabase-js";
import {
  corsHeaders,
  handleError,
  successResponse,
  withAuth,
} from "../_shared/middleware.ts";
import {
  CreateUserSchema,
  UpdateUserSchema,
  validateRequest
} from "../_shared/validation.ts";

const isFutureBan = (bannedUntil?: string | null) => {
  if (!bannedUntil) return false;
  const timestamp = new Date(bannedUntil).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
};

const mergeProfileWithAuthStatus = (profile: any, authUser?: any | null) => {
  const bannedUntil = authUser?.banned_until || null;
  const authIsBanned = isFutureBan(bannedUntil);

  return {
    ...profile,
    profile_is_locked: profile?.is_locked === true,
    auth_banned_until: bannedUntil,
    auth_is_banned: authIsBanned,
    is_locked: profile?.is_locked === true || authIsBanned,
  };
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Authentication & Authorization Middleware
    const { profile: requester } = await withAuth(req, ["ADMIN", "LIBRARIAN"]);

    const url = new URL(req.url);
    const path = url.pathname.split("/").pop() || "";

    // 2. Routing (Controller Pattern)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", // Requires elevated permissions
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    /**
     * POST /create-user
     */
    if (req.method === "POST" && (path === "create-user" || path === "")) {
      const data = await validateRequest(req, CreateUserSchema);
      const { email, password, fullName, role } = data as any;

      // Governance check: Only Super Admin can create Admin/Librarian
      if (
        !requester.is_super_admin &&
        (role === "ADMIN" || role === "LIBRARIAN")
      ) {
        throw {
          message: "Only Super Admin can create Admin or Librarian accounts",
          status: 403,
        };
      }

      // Create Auth User (Admin API)
      const { data: newUser, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });

      if (authError) throw authError;

      // Update Profile (Sync)
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          full_name: (data as any).fullName,
          role: (data as any).role,
        })
        .eq("id", newUser.user.id);

      if (profileError) throw profileError;

      return successResponse(
        {
          message: "User created successfully",
          user: { id: newUser.user.id, email: newUser.user.email },
        },
        201,
      );
    }

    /**
     * GET /list-users
     */
    if (req.method === "GET" && path === "list-users") {
      const { data: users, error } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const { data: authUsersPage, error: authUsersError } =
        await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });

      if (authUsersError) {
        console.warn(
          "[admin-manager] Failed to load auth users:",
          authUsersError.message,
        );
      }

      const authUsersById = new Map(
        (authUsersPage?.users || []).map((user: any) => [user.id, user]),
      );
      const mergedUsers = (users || []).map((user: any) => {
        const authUser = authUsersById.get(user.id);
        return mergeProfileWithAuthStatus(user, authUser);
      });

      return successResponse(mergedUsers);
    }

    /**
     * PUT /update-user
     */
    if (req.method === "PUT" && path === "update-user") {
      const data = await validateRequest(req, UpdateUserSchema);
      const { id, fullName, role, isLocked } = data as any;

      // Fetch target profile for governance check
      const { data: targetProfile } = await supabaseAdmin
        .from("profiles")
        .select("role, is_super_admin, is_locked")
        .eq("id", id)
        .single();

      if (!targetProfile) throw { message: "User not found", status: 404 };

      // Governance check: Cannot update Super Admin
      if (targetProfile.is_super_admin && requester.id !== id) {
        throw { message: "Cannot modify Super Admin account", status: 403 };
      }

      // Hierarchy Enforcement:
      // 1. Only Super Admin can promote/demote to Admin/Librarian
      if (
        !requester.is_super_admin &&
        role &&
        role !== targetProfile.role &&
        (role === "ADMIN" ||
          role === "LIBRARIAN" ||
          targetProfile.role === "ADMIN" ||
          targetProfile.role === "LIBRARIAN")
      ) {
        throw {
          message: "Insufficient permissions to change administrative roles",
          status: 403,
        };
      }

      // 2. Librarian cannot manage Admin/Librarian
      if (
        requester.role === "LIBRARIAN" &&
        (targetProfile.role === "ADMIN" || targetProfile.role === "LIBRARIAN")
      ) {
        throw {
          message: "Librarians cannot manage other administrative accounts",
          status: 403,
        };
      }

      // 3. Admin cannot manage other Admins (except themselves maybe, but we prevent it for safety)
      if (
        requester.role === "ADMIN" &&
        targetProfile.role === "ADMIN" &&
        requester.id !== id
      ) {
        throw {
          message: "Admins cannot manage other Admin accounts",
          status: 403,
        };
      }

      const updatePayload: any = {};
      if (fullName !== undefined) updatePayload.full_name = fullName;
      if (role !== undefined) updatePayload.role = role;
      if (isLocked !== undefined) updatePayload.is_locked = isLocked;

      let authStatusChanged = false;
      let updatedAuthUser: any | null = null;

      // Sync auth status first so the UI never shows unlocked while Auth still blocks login.
      if (isLocked !== undefined) {
        const { data: authStatus, error: authStatusError } =
          await supabaseAdmin.auth.admin.updateUserById(id, {
            ban_duration: isLocked ? "876000h" : "none", // 100 years or unban
          });

        if (authStatusError) throw authStatusError;
        updatedAuthUser = authStatus?.user || null;
        authStatusChanged = true;
      }

      const { data: updatedProfile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();

      if (profileError) {
        if (authStatusChanged) {
          const { error: rollbackError } =
            await supabaseAdmin.auth.admin.updateUserById(id, {
              ban_duration: targetProfile.is_locked ? "876000h" : "none",
            });
          if (rollbackError) {
            console.warn(
              "[admin-manager] Failed to roll back auth lock status:",
              rollbackError.message,
            );
          }
        }
        throw profileError;
      }

      if (!updatedAuthUser) {
        const { data: currentAuthUser, error: currentAuthError } =
          await supabaseAdmin.auth.admin.getUserById(id);
        if (currentAuthError) {
          console.warn(
            "[admin-manager] Failed to refresh auth user:",
            currentAuthError.message,
          );
        }
        updatedAuthUser = currentAuthUser?.user || null;
      }

      return successResponse({
        message: "User updated successfully",
        user: mergeProfileWithAuthStatus(updatedProfile, updatedAuthUser),
      });
    }

    /**
     * DELETE /delete-user
     */
    if (req.method === "DELETE" && path === "delete-user") {
      let userId: string | null = null;

      // Try body first, then query params
      try {
        const body = await req.json();
        userId = body.userId || body.id;
      } catch {
        userId = url.searchParams.get("userId") || url.searchParams.get("id");
      }

      if (!userId) throw { message: "User ID is required", status: 400 };

      // Fetch target profile for governance check
      const { data: targetProfile } = await supabaseAdmin
        .from("profiles")
        .select("role, is_super_admin")
        .eq("id", userId)
        .single();

      if (!targetProfile) throw { message: "User not found", status: 404 };

      // Governance check: Cannot delete Super Admin
      if (targetProfile.is_super_admin) {
        throw { message: "Cannot delete Super Admin account", status: 403 };
      }

      // Governance check: Only Super Admin can delete other Admins or Librarians
      if (
        !requester.is_super_admin &&
        (targetProfile.role === "ADMIN" || targetProfile.role === "LIBRARIAN")
      ) {
        throw {
          message: "Insufficient permissions to delete administrative accounts",
          status: 403,
        };
      }

      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) {
        // If it's a foreign key error, give a better message
        if (error.message?.includes("foreign key constraint")) {
          throw {
            message:
              "Cannot delete user with active borrowing history or reviews. Lock the account instead.",
            status: 400,
          };
        }
        throw error;
      }

      return successResponse({ message: "User deleted successfully" });
    }

    throw { message: "Route not found", status: 404 };
  } catch (err) {
    return handleError(err);
  }
});
