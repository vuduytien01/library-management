-- 1. Xóa sạch Trigger và Hàm cũ
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Hàm xử lý Siêu Cấp (Ultra-Safe)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    target_role TEXT := 'MEMBER';
    raw_code TEXT;
    final_name TEXT;
BEGIN
    -- Lấy mã nâng cấp từ metadata (nếu có lúc SignUp)
    raw_code := NEW.raw_user_meta_data->>'registration_code';
    
    IF raw_code IS NOT NULL THEN
        IF UPPER(TRIM(raw_code)) = 'ADMIN_SECRET_2026' THEN
            target_role := 'ADMIN';
        ELSIF UPPER(TRIM(raw_code)) = 'LIB_SECRET_2026' THEN
            target_role := 'LIBRARIAN';
        END IF;
    END IF;

    -- Lấy tên hiển thị từ nhiều nguồn khác nhau (Google, Github, Email)
    final_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name', 
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'display_name',
        NEW.raw_user_meta_data->>'user_name',
        split_part(NEW.email, '@', 1), -- Lấy phần trước @ nếu không có tên
        'Người dùng BiblioTech'
    );

    -- THỬ LƯU VÀO PROFILES (Bọc trong BEGIN...EXCEPTION để không bao giờ làm hỏng Auth)
    BEGIN
        INSERT INTO public.profiles (id, full_name, role, updated_at)
        VALUES (NEW.id, final_name, target_role, now());
        
        -- Ghi log thành công vào DB log (xem trong Supabase Logs)
        RAISE NOTICE 'SUCCESS: Profile created for user %', NEW.id;
    EXCEPTION WHEN OTHERS THEN
        -- Nếu lỗi (ví dụ: bảng chưa có cột), vẫn cho qua để User tạo được tài khoản Auth
        RAISE WARNING 'FAULT: Fallback for user % - Error: %', NEW.id, SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Kích hoạt Trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. BẬT RLS VÀ CẤP QUYỀN
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Profiles Access" ON public.profiles;
CREATE POLICY "Public Profiles Access" ON public.profiles 
FOR SELECT USING (true); -- Cho phép xem mọi profile để tìm kiếm

DROP POLICY IF EXISTS "Own Profile Update" ON public.profiles;
CREATE POLICY "Own Profile Update" ON public.profiles 
FOR UPDATE USING (auth.uid() = id); -- Cho phép tự cập nhật role thông qua code

-- 5. ĐỒNG BỘ HÓA TOÀN BỘ NGƯỜI DÙNG HIỆN TẠI (Backfill)
-- Chạy đoạn này để sửa tất cả tài khoản cũ bị lỗi profile
INSERT INTO public.profiles (id, full_name, role, updated_at)
SELECT 
  id, 
  COALESCE(
    raw_user_meta_data->>'full_name', 
    raw_user_meta_data->>'name', 
    split_part(email, '@', 1),
    'Thành viên cũ'
  ), 
  'MEMBER',
  now()
FROM auth.users
ON CONFLICT (id) DO NOTHING;
