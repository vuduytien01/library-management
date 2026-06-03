// Deno type definitions are provided by deno.d.ts in the functions root

// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

/**
 * Robust Error Handler for Edge Functions
 */
export const handleError = (error: any) => {
  console.error("[Middleware Error]:", error);
  return new Response(
    JSON.stringify({
      error: error.message || "Internal Server Error",
      status: error.status || 500,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: error.status || 500,
    },
  );
};

/**
 * Authentication Middleware (Verify JWT & Role)
 */
export async function withAuth(req: Request, allowedRoles: string[] = []) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader)
      throw { message: "Missing Authorization header", status: 401 };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) throw { message: "Invalid token", status: 401 };

    // Check Role from Public.Profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, is_super_admin")
      .eq("id", user.id)
      .single();

    if (
      !profile ||
      (allowedRoles.length > 0 && !allowedRoles.includes(profile.role))
    ) {
      throw { message: "Unauthorized: Insufficient permissions", status: 403 };
    }

    return { user, profile: { ...profile, id: profile.id || user.id } };
  } catch (err) {
    throw err;
  }
}

/**
 * Standard Success Response
 */
export const successResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
};
