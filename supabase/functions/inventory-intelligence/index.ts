import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import {
  corsHeaders,
  handleError,
  successResponse,
  withAuth,
} from "../_shared/middleware.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Authentication & Authorization
    // Access restricted to ADMIN and LIBRARIAN roles
    const { user } = await withAuth(req, ["ADMIN", "LIBRARIAN"]);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // 2. Data Retrieval for AI Analysis
    const { data: branches } = await supabaseAdmin.from("branches").select("*");

    // Define analysis window (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentBorrows } = await supabaseAdmin
      .from("borrow_records")
      .select("*, book:books(title, category)")
      .gte("borrowed_at", thirtyDaysAgo.toISOString());

    const { data: inventory } = await supabaseAdmin
      .from("branch_inventory")
      .select("*, book:books(title, category)");

    // 3. Data Synthesis
    const dataSummary = {
      branches: branches?.map((b) => ({ id: b.id, name: b.name })),
      activityCount: recentBorrows?.length || 0,
      inventoryAlerts: inventory
        ?.filter((i) => i.available_copies <= 1)
        .map((i) => ({
          branch: branches?.find((b) => b.id === i.branch_id)?.name,
          title: i.book?.title,
          isbn: i.book_isbn,
          available: i.available_copies,
        })),
      branchActivity: branches?.map((b) => ({
        name: b.name,
        borrows: recentBorrows?.filter((r) => r.branch_id === b.id).length || 0,
        totalStock:
          inventory
            ?.filter((i) => i.branch_id === b.id)
            .reduce((acc, i) => acc + i.total_copies, 0) || 0,
      })),
    };

    // 4. AI Forecasting with Gemini
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey)
      throw new Error(
        "GEMINI_API_KEY is not configured in environment variables",
      );

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
      You are the Inventory Intelligence AI for the BiblioTech Library Management System.
      Your goal is to coordinate book copies between branches to maximize accessibility.
      
      CURRENT STATE DATA:
      ${JSON.stringify(dataSummary, null, 2)}
      
      TASK:
      1. Analyze the borrowing demand per branch.
      2. Identify "inventory deserts" where books are needed but unavailable.
      3. Suggest 3-5 specific "Inventory Coordination" steps (transfers).
      
      OUTPUT FORMAT:
      Return ONLY a JSON array of objects. Do not include markdown code blocks.
      [
        {
          "type": "TRANSFER_ADVICE",
          "branch_id": "target_branch_uuid",
          "book_isbn": "isbn_string_or_null",
          "suggestion_text": "Human readable explanation of the recommendation",
          "confidence_score": 0.0-1.0,
          "metadata": { 
            "action": "transfer", 
            "from_branch": "source_branch_name", 
            "to_branch": "target_branch_name", 
            "quantity": number 
          }
        }
      ]
    `;

    const result = await model.generateContent(prompt);
    const rawResponse = result.response.text();
    const cleanJson = rawResponse.replace(/```json|```/g, "").trim();
    const suggestions = JSON.parse(cleanJson);

    // 5. Persistence
    if (Array.isArray(suggestions)) {
      const { error: insertError } = await supabaseAdmin
        .from("inventory_suggestions")
        .insert(
          suggestions.map((s) => ({
            ...s,
            created_at: new Date().toISOString(),
          })),
        );

      if (insertError)
        console.error("[DB Error] Failed to save suggestions:", insertError);
    }

    return successResponse({
      status: "success",
      generated_at: new Date().toISOString(),
      suggestions,
    });
  } catch (err: any) {
    return handleError(err);
  }
});
