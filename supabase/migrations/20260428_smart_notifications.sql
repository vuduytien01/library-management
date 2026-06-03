-- Làn 22: Smart Notification Engine
-- Database Triggers and Functions for Automated Alerts

-- 1. Helper Function to trigger Edge Function (Webhook replacement)
-- Note: In a real Supabase environment, you'd use the Dashboard Webhooks UI.
-- Here we'll define the triggers that insert into the notifications table.

-- Function to create notification record
CREATE OR REPLACE FUNCTION public.create_smart_notification(
    p_user_id UUID,
    p_title TEXT,
    p_body TEXT,
    p_type TEXT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.notifications (user_id, title, body, type)
    VALUES (p_user_id, p_title, p_body, p_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger: Level Up Notification
CREATE OR REPLACE FUNCTION public.fn_on_level_up()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.level > OLD.level) THEN
        PERFORM public.create_smart_notification(
            NEW.id,
            'Chúc mừng! Bạn đã thăng cấp! 🎉',
            'Bạn vừa đạt cấp độ ' || NEW.level || '. Tiếp tục tích lũy XP để mở khóa nhiều tính năng hơn nhé!',
            'LEVEL_UP'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_on_level_up ON public.profiles;
CREATE TRIGGER tr_on_level_up
    AFTER UPDATE OF level ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.fn_on_level_up();

-- 3. Trigger: New Badge Notification
CREATE OR REPLACE FUNCTION public.fn_on_new_badge()
RETURNS TRIGGER AS $$
DECLARE
    v_badge_name TEXT;
BEGIN
    SELECT name INTO v_badge_name FROM public.badges WHERE id = NEW.badge_id;
    
    PERFORM public.create_smart_notification(
        NEW.user_id,
        'Huy hiệu mới đã mở khóa! 🏆',
        'Bạn vừa nhận được huy hiệu "' || v_badge_name || '". Kiểm tra bộ sưu tập của bạn ngay!',
        'BADGE'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_on_new_badge ON public.user_badges;
CREATE TRIGGER tr_on_new_badge
    AFTER INSERT ON public.user_badges
    FOR EACH ROW EXECUTE FUNCTION public.fn_on_new_badge();

-- 4. Trigger: New Club Message Notification
-- Only notify users in the club EXCEPT the sender
CREATE OR REPLACE FUNCTION public.fn_on_new_club_message()
RETURNS TRIGGER AS $$
DECLARE
    v_club_name TEXT;
    v_member_id UUID;
    v_sender_name TEXT;
BEGIN
    SELECT name INTO v_club_name FROM public.book_clubs WHERE id = NEW.club_id;
    SELECT full_name INTO v_sender_name FROM public.profiles WHERE id = NEW.user_id;

    FOR v_member_id IN 
        SELECT user_id FROM public.book_club_members 
        WHERE club_id = NEW.club_id AND user_id != NEW.user_id
    LOOP
        PERFORM public.create_smart_notification(
            v_member_id,
            v_club_name || ' 💬',
            v_sender_name || ': ' || LEFT(NEW.content, 50) || (CASE WHEN LENGTH(NEW.content) > 50 THEN '...' ELSE '' END),
            'MESSAGE'
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_on_new_club_message ON public.book_club_messages;
CREATE TRIGGER tr_on_new_club_message
    AFTER INSERT ON public.book_club_messages
    FOR EACH ROW EXECUTE FUNCTION public.fn_on_new_club_message();

-- 5. Note on Webhook:
-- To actually call the Edge Function when a row is inserted into `notifications`,
-- the user should enable Database Webhooks in the Supabase Dashboard:
-- Table: notifications
-- Events: INSERT
-- URL: {SUPABASE_URL}/functions/v1/push-dispatcher
-- Auth: Service Role Key
