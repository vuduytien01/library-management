# BiblioTech v2.0 Premium - Báo Cáo Tổng Thể Dự Án (Project Master Report)

Tài liệu này tổng hợp toàn bộ quá trình phát triển, các công nghệ, kỹ thuật và nguyên lý kiến trúc đã được áp dụng để xây dựng hệ thống quản lý thư viện BiblioTech v2.0 Premium.

---

## 1. Tổng Quan Chức Năng (Functionality Overview)

Hệ thống được thiết kế với 3 vai trò chính, mỗi vai trò có các chức năng chuyên biệt:

### **Thành Viên (Member)**
- **Khám Phá & Tìm Kiếm:** Tìm kiếm sách thông minh qua Google Books/OpenLib API.
- **Mượn/Trả Sách:** Quy trình mượn sách vật lý và sách nói kỹ thuật số.
- **Thẻ Thành Viên Kỹ Thuật Số:** Tích hợp QR Code và Apple/Google Wallet.
- **Thư Viện Cá Nhân:** Theo dõi lịch sử mượn, sách yêu thích và tiến trình đọc.
- **Sách Nói (Audiobooks):** Trình phát nhạc cao cấp với chế độ hẹn giờ và điều chỉnh tốc độ.
- **Tương Tác Cộng Đồng:** Ghi chú cộng tác (Collaborative Annotations) và câu lạc bộ sách.

### **Thủ Thư (Librarian)**
- **Quản Lý Kho Sách:** Nhập sách nhanh qua quét mã vạch (Expo-camera).
- **Phân Tích Chuyên Sâu (Deep Analytics):** Dashboard thông minh theo dõi tỷ lệ giữ chân, mượn sách và thể loại xu hướng.
- **Trí Tuệ Nhân Tạo (AI Intelligence):** Dự báo nhu cầu mượn sách (Predictive Demand) và đề xuất điều phối kho sách.
- **Xử Lý Mượn/Trả:** Quản lý quy trình mượn trả tại quầy thông qua mã QR.

### **Quản Trị Viên (Admin)**
- **Quản Lý Người Dùng:** Kiểm soát quyền hạn (Role-based Access Control).
- **Kiểm Soát Bảo Mật (Security Audit):** Nhật ký hệ thống chi tiết (Audit Logs) với khả năng xem thay đổi dữ liệu (JSON Diff).
- **Báo Cáo Tài Chính:** Thống kê doanh thu và hiệu suất thư viện.

---

## 2. Công Nghệ Sử Dụng (Technology Stack)

| Lớp (Layer) | Công Nghệ | Lý Do Sử Dụng |
| :--- | :--- | :--- |
| **Frontend** | React Native (Expo) | Phát triển đa nền tảng (iOS/Android) với hiệu năng bản địa. |
| **Backend** | Supabase (Postgres) | Backend-as-a-Service mạnh mẽ, hỗ trợ Real-time và Auth. |
| **Database** | PostgreSQL | Cơ sở dữ liệu quan hệ tin cậy, hỗ trợ JSONB cho Audit Logs. |
| **AI / ML** | Google Gemini / OpenAI | Phân tích xu hướng và dự báo nhu cầu mượn sách. |
| **Media** | Cloudflare R2 / Expo-AV | Lưu trữ và phát sách nói tốc độ cao. |
| **Styling** | Vanilla StyleSheet | Tối ưu hiệu năng render và kiểm soát giao diện premium. |
| **Navigation** | Expo Router | Routing dựa trên file-system hiện đại, dễ bảo trì. |

---

## 3. Kỹ Thuật & Nguyên Lý Kiến Trúc (Architectural Principles)

### **Kiến Trúc Lai: Phân Lớp & Chức Năng (Hybrid Feature-Layered Architecture)**
Hệ thống đã được chuẩn hóa sang mô hình kiến trúc lai hiện đại, kết hợp ưu điểm của Clean Architecture (phân lớp) và Feature-based Architecture (theo chức năng):

1.  **Core Layer (`src/core/`):** Tầng hạ tầng (Infrastructure). Chứa các dịch vụ dùng chung toàn hệ thống (AI, Sync, Haptics, Payment, Notifications). Đây là "Single Source of Truth" cho các cross-cutting concerns.
2.  **Domain Feature Layer (`src/features/`):** Tầng chức năng. Chia theo domain nghiệp vụ (Members, Admin, Books). Mỗi feature bao gồm Service (Logic), Types và Components riêng.
    - *Consolidation:* Các logic ngoại tuyến (offline), tải xuống và hàng đợi hành động (Action Queue) đã được gộp hoàn toàn vào `membersService`.
3.  **Unified Gateway Layer (`src/hooks/library/`):** Tầng truy cập dữ liệu. Gộp toàn bộ hooks lẻ vào `useLibrary` (Hub Hooks), giúp UI không cần biết logic lấy dữ liệu từ đâu (Supabase hay Local Cache).
4.  **UI Layer (`app/`):** Tầng hiển thị. Phân tách theo route group (`(member)`, `(admin)`, `(librarian)`). Tuyệt đối không chứa business logic.

### **Kỹ Thuật Nổi Bật & File Tương Ứng**

| Kỹ Thuật | File Quan Trọng | Mô Tả |
| :--- | :--- | :--- |
| **Unified Gateway** | `src/hooks/useLibrary.ts` | Điểm truy cập duy nhất (Single Entry Point) cho toàn bộ logic ứng dụng. |
| **Offline Sync Queue** | `src/core/sync.ts` | Hệ thống hàng đợi đồng bộ hóa dữ liệu khi mất kết nối (Offline-first). |
| **Domain Services** | `src/features/*/services.ts` | Tập trung hóa business logic theo chức năng (Members, Admin). |
| **JSON Diff System** | `app/(admin)/audit.tsx` | Hệ thống kiểm soát thay đổi dữ liệu Side-by-side cho Admin. |
| **AI Hub Service** | `src/core/ai.ts` | Trung tâm xử lý trí tuệ nhân tạo (Chat, Voice, Logistics). |
| **Digital Wallet** | `src/core/payment.ts` | Tích hợp Apple/Google Wallet và VietQR cho thẻ thành viên. |
| **Haptic Hub** | `src/core/haptics.ts` | Chuẩn hóa phản hồi xúc giác (Haptics) trên toàn hệ thống. |

---

## 4. Chi Tiết Các Phase Đã Thực Hiện (Implementation Phases)

### **Phase 1-4: Foundation & Core Features**
- Thiết lập Supabase, Auth, và Schema cơ sở dữ liệu.
- Xây dựng dashboard cơ bản cho Member và Thủ thư.
- Triển khai chức năng quét mã vạch và tìm kiếm sách.

### **Phase 5-6: Advanced Experience**
- Tích hợp hệ thống Sách nói (Audiobooks) và lưu trữ Cloudflare R2.
- Triển khai Thẻ thành viên kỹ thuật số (Wallet integration).
- Xây dựng hệ thống Ghi chú cộng tác (Collaborative Annotations).

### **Phase 7: Architecture Consolidation & Intelligence (Hoàn tất)**
- **Consolidation:** Chuyển đổi toàn bộ codebase sang kiến trúc Feature-based Layered. Gộp hơn 20 hooks và 10 services phân mảnh thành các Hub Services/Hooks thống nhất.
- **Deep Analytics:** Xây dựng hệ thống báo cáo chuyên sâu và AI Logistics cho Thủ thư.
- **Security Audit:** Hệ thống giám sát bảo mật với JSON Diff cho Admin.
- **Final Polish:** Tối ưu hóa hiệu năng, hoàn thiện đa ngôn ngữ và chuẩn hóa UI/UX Premium.

---

## 5. Cam Kết Chất Lượng (Premium Standards)

- **Aesthetics:** Sử dụng tông màu "Dark Navy" (#0B0F1A), Glassmorphism, và Blur effects.
- **Performance:** Sử dụng `react-query` để caching dữ liệu, giảm thiểu re-render.
- **Security:** RLS (Row Level Security) được cấu hình chặt chẽ trên Supabase cho từng bảng.

**Tác giả:** Antigravity AI
**Phiên bản:** BiblioTech v2.0 Premium Final Release (Standardized)
**Ngày hoàn tất:** 29/04/2026
**Trạng thái:** Toàn bộ hệ thống đã được đồng bộ và kiểm thử tĩnh (Static Verification Pass).
