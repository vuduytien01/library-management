import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "../api/supabase";

// Lấy API Key từ biến môi trường
const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";
const TEXT_MODEL =
  process.env.EXPO_PUBLIC_GEMINI_TEXT_MODEL || "gemini-2.0-flash";
const genAI = new GoogleGenerativeAI(API_KEY);

const getTextModel = () => genAI.getGenerativeModel({ model: TEXT_MODEL });

export const ai = {
  /**
   * Trò chuyện với thủ thư ảo BiblioAI
   */
  async askLibrarian(
    userPrompt: string,
    bookContext?: string,
  ): Promise<string> {
    if (!API_KEY) {
      console.warn("[AiService] Gemini API Key missing. Returning fallback.");
      return this.fallbackChat(userPrompt);
    }

    try {
      const model = getTextModel();

      // Attempt to enrich context with semantic search for recommendation prompts
      let semanticContext = "";
      const lowerPrompt = userPrompt.toLowerCase();
      if (
        lowerPrompt.includes("gợi ý") ||
        lowerPrompt.includes("tìm") ||
        lowerPrompt.includes("sách nào") ||
        lowerPrompt.includes("muốn đọc")
      ) {
        try {
          const matches = await this.semanticSearch(userPrompt, 0.4, 3);
          if (matches && matches.length > 0) {
            semanticContext = `\nSách hiện có trong thư viện phù hợp với yêu cầu: ${matches.map((m: any) => `"${m.title}" của ${m.author}`).join(", ")}.`;
          }
        } catch (e) {
          console.warn("[AiService] Context enrichment failed:", e);
        }
      }

      const systemPrompt = `Bạn là BiblioAI - trợ lý thủ thư ảo thông minh và thân thiện của thư viện BiblioTech v2.0 Premium. 
      Nhiệm vụ của bạn là giải đáp tất cả câu hỏi của người dùng bằng tiếng Việt, lịch sự, chuyên nghiệp.

      Hãy sử dụng các thông tin và quy tắc của hệ thống BiblioTech dưới đây để trả lời chính xác:
      - Giới hạn mượn sách: Người dùng có thể mượn tối đa 5 cuốn sách cùng lúc.
      - Quy định bản in: Mỗi đầu sách luôn được lưu giữ tối thiểu 3 bản in vật lý tại thư viện.
      - Thời hạn mượn sách: 14 ngày đối với Thành viên (Member) và 30 ngày đối với Quản trị viên (Admin).
      - Phí phạt trả muộn: 2.000 VNĐ cho mỗi ngày trễ hạn.
      - Các chi nhánh: Thư viện hiện có 3 chi nhánh: Trụ sở chính (Main Branch), Chi nhánh 2, Chi nhánh 3. Người dùng có thể mượn tại một chi nhánh và trả tại bất kỳ chi nhánh nào.
      - Hệ thống cấp độ (Level & XP): Độc giả tích lũy điểm XP qua các hoạt động (trả đúng hạn được 50 XP). Công thức tính Level = Math.floor(XP / 100) + 1.
      - Tính năng AI: Bạn có thể tra cứu tìm kiếm sách, tóm tắt sách, đưa ra gợi ý đọc sách dựa trên sở thích độc giả.

      ${bookContext ? `Ngữ cảnh sách hiện tại: ${bookContext}` : ""}
      ${semanticContext ? `Ngữ cảnh sách thực tế trong kho: ${semanticContext}` : ""}
      
      Hãy trả lời bằng tiếng Việt, ngắn gọn, súc tích và truyền cảm hứng đọc sách.`;

      const result = await model.generateContent([systemPrompt, userPrompt]);
      const response = await result.response;
      const responseText = response.text();

      if (
        !responseText ||
        responseText.includes("Error") ||
        responseText.includes("403") ||
        responseText.includes("404")
      ) {
        return this.fallbackChat(userPrompt);
      }

      return responseText;
    } catch (error: any) {
      console.warn(
        "[AiService] Gemini Error. Using advanced rule fallback.",
        error,
      );
      return this.fallbackChat(userPrompt);
    }
  },

  /**
   * Phân tích tóm tắt nhanh về một cuốn sách
   */
  async summarizeBook(title: string, author: string, description: string) {
    if (!API_KEY) return this.fallbackSummarize(title, author, description);

    try {
      const model = getTextModel();
      const prompt = `Bạn là BiblioAI, một thủ thư thông minh. Hãy tóm tắt cuốn sách "${title}" của tác giả "${author}" dựa trên mô tả sau: "${description}". 
      Yêu cầu:
      1. Tóm tắt súc tích, dễ hiểu.
      2. Nêu bật 3 giá trị cốt lõi hoặc bài học chính dưới dạng bullet points.
      3. Giọng văn truyền cảm hứng, chuyên nghiệp.
      4. Định dạng bằng Markdown.`;

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.warn(
        "[AiService] Error summarizing book, using fallback.",
        error,
      );
      return this.fallbackSummarize(title, author, description);
    }
  },

  /**
   * Dịch tiêu đề, mô tả, tác giả và giọng đọc sang tiếng Anh và tiếng Việt
   */
  async translateMetadata(
    title: string,
    description: string,
    author?: string,
    narrator?: string,
  ): Promise<{
    title_en: string;
    title_vi: string;
    description_en: string;
    description_vi: string;
    author_en?: string;
    author_vi?: string;
    narrator_en?: string;
    narrator_vi?: string;
  }> {
    if (!API_KEY) {
      return {
        title_en: title,
        title_vi: title,
        description_en: description,
        description_vi: description,
        author_en: author,
        author_vi: author,
        narrator_en: narrator,
        narrator_vi: narrator,
      };
    }
    try {
      const model = getTextModel();
      const prompt = `Translate the following book/audiobook metadata into both English and Vietnamese. Return exactly in JSON format without markdown code fences:
      {
        "title_en": "...",
        "title_vi": "...",
        "description_en": "...",
        "description_vi": "...",
        "author_en": "...",
        "author_vi": "...",
        "narrator_en": "...",
        "narrator_vi": "..."
      }
      
      Input:
      - Title: "${title}"
      - Description: "${description}"
      ${author ? `- Author: "${author}"` : ""}
      ${narrator ? `- Narrator: "${narrator}"` : ""}`;

      const result = await model.generateContent(prompt);
      const text = result.response
        .text()
        .replace(/\`\`\`json|\`\`\`/g, "")
        .trim();
      return JSON.parse(text);
    } catch (error) {
      console.warn("[AiService] Error translating metadata:", error);
      return {
        title_en: title,
        title_vi: title,
        description_en: description,
        description_vi: description,
        author_en: author,
        author_vi: author,
        narrator_en: narrator,
        narrator_vi: narrator,
      };
    }
  },

  /**
   * Lấy tóm tắt sách dựa trên ISBN
   */
  async getBookSummary(isbn: string) {
    try {
      const { data: book, error } = await supabase
        .from("books")
        .select("title, author, description")
        .eq("isbn", isbn)
        .single();

      if (error || !book) throw new Error("Không tìm thấy thông tin sách");

      return this.summarizeBook(
        book.title,
        book.author,
        book.description || "",
      );
    } catch (error) {
      console.error("[AiService] getBookSummary error:", error);
      throw error;
    }
  },

  /**
   * Tạo vector embedding cho văn bản (768 dimensions)
   */
  async generateEmbedding(text: string) {
    if (!API_KEY) throw new Error("Missing Gemini API Key");

    try {
      // Use text-embedding-004
      const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
      const result = await model.embedContent(text);

      return result.embedding.values;
    } catch (error) {
      console.error(
        "[AiService] Embedding error with text-embedding-004:",
        error,
      );
      try {
        // Fallback to older embedding model
        const model = genAI.getGenerativeModel({
          model: "gemini-embedding-001",
        });
        const result = await model.embedContent(text);
        return result.embedding.values;
      } catch (err2) {
        console.error("[AiService] Embedding fallback error:", err2);
        throw err2;
      }
    }
  },

  /**
   * Gợi ý sách cá nhân hóa dựa trên lịch sử
   */
  async getPersonalizedRecommendations(history: string[]) {
    if (!API_KEY) return [];
    try {
      const model = getTextModel();
      const prompt = `Dựa trên danh sách các cuốn sách người dùng đã đọc: [${history.join(", ")}].
      Hãy gợi ý 5 cuốn sách khác có chủ đề tương tự hoặc phong cách tương đồng.
      Chỉ trả về danh sách tên sách, mỗi cuốn một dòng.`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return text
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => line.replace(/^\d+\.\s*/, "").trim());
    } catch (error) {
      console.error("[AiService] Recommendation error:", error);
      return [];
    }
  },

  /**
   * Gợi ý sách cá nhân hóa nâng cao (Semantic Discovery)
   */
  async getRecommendationsByProfile(titles: string[], categories: string[]) {
    if (!API_KEY) return [];
    try {
      // Build a profile context from reading history
      const context = `Người dùng thích các thể loại: ${categories.join(", ")}. Các sách đã đọc: ${titles.join(", ")}. Hãy gợi ý các sách tương tự.`;
      return this.semanticSearch(context, 0.3, 10);
    } catch (error) {
      console.error("[AiService] Semantic recommendation error:", error);
      return [];
    }
  },

  /**
   * Khởi tạo phiên trò chuyện với AI
   */
  async startChat(
    history: { role: "user" | "model"; parts: { text: string }[] }[] = [],
  ) {
    if (!API_KEY) throw new Error("Missing API Key");

    const model = getTextModel();
    const systemPrompt = `Bạn là BiblioAI - thủ thư ảo thông minh của thư viện BiblioTech. 
    Hãy trả lời bằng tiếng Việt, thân thiện và chuyên nghiệp. 
    Nếu người dùng hỏi về sách, hãy cố gắng gợi ý những đầu sách hay.`;

    return model.startChat({
      history: [
        { role: "user", parts: [{ text: systemPrompt }] },
        {
          role: "model",
          parts: [
            {
              text: "Tôi đã sẵn sàng! Tôi là BiblioAI, thủ thư của bạn. Tôi có thể giúp gì cho bạn hôm nay?",
            },
          ],
        },
        ...history,
      ],
    });
  },

  /**
   * Tìm kiếm sách bằng ngữ nghĩa (Semantic Search)
   */
  async semanticSearch(query: string, threshold = 0.4, count = 5) {
    try {
      const embedding = await this.generateEmbedding(query);
      const { data, error } = await supabase.rpc("match_books", {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: count,
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error("[AiService] Semantic search error:", error);
      return [];
    }
  },

  /**
   * Xử lý lệnh giọng nói từ người dùng
   */
  async processVoiceCommand(transcription: string) {
    if (!API_KEY)
      return { text: "AI chưa được cấu hình.", intent: "chat", books: [] };

    try {
      const model = getTextModel();
      const prompt = `Bạn là thủ thư ảo BiblioAI. Người dùng vừa nói: "${transcription}".
      Hãy phân tích ý định của người dùng và trả về một đối tượng JSON:
      {
        "response": "Câu trả lời thân thiện của bạn (Tiếng Việt)",
        "intent": "search", "chat", hoặc "guide",
        "searchQuery": "Từ khóa tìm kiếm tối ưu nếu intent là search, nếu không thì để trống"
      }`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      // Clean JSON if Gemini adds markdown markers
      const jsonStr = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(jsonStr);

      let books: any[] = [];
      if (parsed.intent === "search" && parsed.searchQuery) {
        books = await this.semanticSearch(parsed.searchQuery, 0.35, 10);
      }

      return {
        text: parsed.response,
        intent: parsed.intent,
        books: books,
        searchQuery: parsed.searchQuery,
      };
    } catch (error) {
      console.error("[AiService] Voice process error:", error);
      return {
        text: `Tôi nghe thấy: "${transcription}". Bạn có muốn tôi tìm kiếm thông tin này không?`,
        intent: "chat",
        books: [],
      };
    }
  },

  /**
   * Phân tích và gợi ý luân chuyển sách giữa các chi nhánh
   */
  async analyzeLogistics(prompt: string): Promise<any[]> {
    if (!API_KEY) return [];
    try {
      const model = getTextModel();
      const result = await model.generateContent(prompt);
      const text = (await result.response)
        .text()
        .replace(/```json|```/g, "")
        .trim();
      return JSON.parse(text);
    } catch (e) {
      console.error("[ai] analyzeLogistics error:", e);
      return [];
    }
  },

  /**
   * Fallback rule-based AI trained with local information & real library books
   */
  async fallbackChat(prompt: string): Promise<string> {
    const lower = prompt.toLowerCase().trim();

    // Fetch real books to have concrete recommendations
    let bookRecs = "";
    try {
      const { data: books } = await supabase
        .from("books")
        .select("title, author, genre")
        .limit(10);
      if (books && books.length > 0) {
        bookRecs =
          "\n\nMột số đầu sách nổi bật tại thư viện:\n" +
          books
            .map(
              (b) =>
                `- **${b.title}** của *${b.author}* (${b.genre || "Văn học"})`,
            )
            .join("\n");
      }
    } catch (e) {
      // ignore
    }

    // Exact and contextual keyword matching
    if (
      lower.includes("chào") ||
      lower.includes("hi") ||
      lower.includes("hello")
    ) {
      return `Xin chào! Tôi là **BiblioAI** - trợ lý thủ thư ảo thông minh của thư viện BiblioTech v2.0 Premium. Tôi có thể giúp bạn tìm kiếm sách, tra cứu thông tin mượn trả, phí phạt và các quy định của thư viện. Bạn cần tôi giúp gì hôm nay?`;
    }

    if (
      lower.includes("khôn") ||
      lower.includes("thông minh") ||
      lower.includes("giỏi") ||
      lower.includes("xịn") ||
      lower.includes("làm được gì")
    ) {
      return `### Tôi là BiblioAI - Thủ thư ảo thông minh thế hệ mới!
Tôi được tích hợp dữ liệu nghiệp vụ thực tế của toàn bộ hệ thống BiblioTech v2.0 Premium. Tôi có thể:
1. **Tra cứu sách**: Gợi ý sách theo sở thích và tìm kiếm sách trong kho dữ liệu thực tế.
2. **Nắm rõ quy định**: Biết chính xác bạn được mượn bao nhiêu sách (tối đa 5 cuốn), khi nào phải trả (14 ngày).
3. **Cung cấp thông tin chi nhánh**: Cho bạn biết thư viện có những chi nhánh nào để mượn trả tiện lợi.
4. **Theo dõi cấp độ độc giả**: Giúp bạn xem điểm XP tích lũy và công thức nâng cấp level!

Bạn muốn trải nghiệm tính năng nào của tôi?`;
    }

    if (
      lower.includes("chỉ có") ||
      lower.includes("thế thôi") ||
      lower.includes("ít vậy") ||
      lower.includes("được thế")
    ) {
      return `Ngoài thông tin quy định, tôi còn sở hữu rất nhiều tính năng thú vị:
- **Tóm tắt nội dung sách (AI Summary):** Chỉ cần chọn một cuốn sách bất kỳ và bấm nút **"Tóm tắt AI"**.
- **Gợi ý cá nhân hóa nâng cao:** Dựa trên thể loại yêu thích và lịch sử đọc của bạn.
- **Tính toán Logistics:** Hỗ trợ thủ thư phân phối sách hiệu quả giữa các chi nhánh.

Bạn hãy thử hỏi tôi về một thể loại sách bạn yêu thích, ví dụ: *"Hãy gợi ý cho tôi sách về Khoa học"*, bạn sẽ thấy tôi trả lời đầy đủ và hữu ích ngay!`;
    }

    if (
      lower.includes("quy định") ||
      lower.includes("mượn") ||
      lower.includes("trả") ||
      lower.includes("tối đa")
    ) {
      return `### Quy định mượn/trả sách tại BiblioTech:
- **Số lượng mượn tối đa:** Bạn có thể mượn tối đa **5 cuốn sách** cùng một lúc.
- **Thời hạn mượn:**
  - **14 ngày** đối với Thành viên (Member).
  - **30 ngày** đối với Quản trị viên (Admin).
- **Phí phạt trễ hạn:** **2.000 VNĐ** cho mỗi ngày trả muộn.
- **Quy định bản in:** Mỗi đầu sách luôn được lưu giữ tối thiểu **3 bản in vật lý** tại thư viện để đảm bảo luôn sẵn sàng phục vụ độc giả.${bookRecs}`;
    }

    if (
      lower.includes("chi nhánh") ||
      lower.includes("ở đâu") ||
      lower.includes("địa chỉ")
    ) {
      return `Hệ thống thư viện BiblioTech hiện có 3 chi nhánh đang hoạt động:
1. **Trụ sở chính (Main Branch):** Trung tâm thành phố, phục vụ tất cả đầu sách.
2. **Chi nhánh 2:** Khu vực phía Tây, chuyên về sách học thuật và khoa học.
3. **Chi nhánh 3:** Khu vực phía Nam, chuyên về sách văn học và kỹ năng sống.

Bạn có thể mượn sách tại một chi nhánh và trả tại bất kỳ chi nhánh nào khác!`;
    }

    if (
      lower.includes("xp") ||
      lower.includes("level") ||
      lower.includes("cấp độ") ||
      lower.includes("điểm")
    ) {
      return `Tại BiblioTech, bạn sẽ tích lũy điểm **XP** khi tham gia các hoạt động đọc sách:
- **Trả sách đúng hạn:** Nhận ngay **50 XP**.
- **Công thức tính cấp độ:** \`Level = Math.floor(XP / 100) + 1\`.
- Càng lên cấp cao, bạn sẽ càng nhận được nhiều quyền lợi đặc biệt từ thư viện!`;
    }

    if (
      lower.includes("gợi ý") ||
      lower.includes("tìm") ||
      lower.includes("sách nào") ||
      lower.includes("đọc gì") ||
      lower.includes("thể loại")
    ) {
      if (bookRecs) {
        return `Tôi rất sẵn lòng gợi ý sách cho bạn! Dựa trên sở thích đọc sách chung của độc giả BiblioTech, dưới đây là các tựa sách hay nhất bạn nên mượn:${bookRecs}\n\nBạn có thể nhấn vào từng cuốn sách để xem tóm tắt chi tiết hoặc mượn sách ngay!`;
      }
      return `Tại thư viện BiblioTech, chúng tôi có rất nhiều tựa sách hấp dẫn về các thể loại như: **Văn học, Lịch sử, Khoa học, Kỹ năng, Phát triển bản thân...** Bạn có thể sử dụng tính năng tìm kiếm trên ứng dụng để tra cứu tựa sách mình yêu thích nhé!`;
    }

    if (lower.includes("tóm tắt") || lower.includes("review")) {
      return `Bạn có thể xem tóm tắt bất kỳ cuốn sách nào tại BiblioTech! Hãy bấm vào cuốn sách bạn quan tâm, chọn nút **"Tóm tắt AI"** hoặc hỏi tôi cụ thể về tên cuốn sách đó nhé.`;
    }

    if (lower.includes("cảm ơn") || lower.includes("thank")) {
      return `Rất vui được hỗ trợ bạn! Chúc bạn có những phút giây đọc sách thật tuyệt vời tại **BiblioTech**. Nếu cần thêm thông tin gì, đừng ngần ngại hỏi tôi nhé!`;
    }

    // Dynamic, varied defaults for unmapped conversational queries
    const fallbacks = [
      `Tôi đã nhận được câu hỏi của bạn. Với tư cách là thủ thư ảo BiblioAI của thư viện BiblioTech, tôi có thể hỗ trợ bạn tìm kiếm sách trong kho, xem thông tin mượn trả hoặc tra cứu các quy định và chi nhánh của thư viện.\n\nHãy cho tôi biết cụ thể tựa sách hoặc chủ đề bạn quan tâm nhé!\n${bookRecs}`,
      `BiblioAI luôn sẵn sàng đồng hành cùng bạn! Tại BiblioTech, chúng tôi có rất nhiều tựa sách hấp dẫn về đa dạng thể loại. Bạn có thể hỏi tôi về quy định mượn (tối đa 5 cuốn), cách tính XP/Level, hoặc các chi nhánh của thư viện.\n\nBạn đang quan tâm đến cuốn sách nào hôm nay?\n${bookRecs}`,
      `Tôi nghe rõ rồi! Tôi có thể chia sẻ thêm về sách mới nhập, quy định mượn sách (tối đa 5 cuốn), hạn trả sách (14 ngày), phí phạt trễ hạn (2.000 VNĐ/ngày), hoặc chi nhánh của BiblioTech.\n\nBạn muốn tra cứu chủ đề nào?\n${bookRecs}`,
    ];
    const randomIndex =
      Math.abs(
        prompt.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0),
      ) % fallbacks.length;
    return fallbacks[randomIndex];
  },

  fallbackSummarize(title: string, author: string, description: string) {
    return `### Tóm tắt cuốn sách **${title}** của tác giả **${author}**:
${description || "Cuốn sách này chứa đựng những kiến thức bổ ích và câu chuyện lôi cuốn giúp người đọc mở mang tri thức và tìm thấy những bài học ý nghĩa trong cuộc sống."}

#### 3 Giá trị cốt lõi nổi bật:
1. **Mở rộng tư duy:** Giúp người đọc nhìn nhận các vấn đề từ nhiều góc độ khác nhau.
2. **Kinh nghiệm thực tế:** Đúc kết những bài học quý giá có tính ứng dụng cao.
3. **Truyền cảm hứng:** Khích lệ độc giả nỗ lực hành động và thay đổi tích cực.`;
  },
};
