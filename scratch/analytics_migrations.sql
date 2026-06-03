-- SQL Migration for Lane 15: Deep Analytics RPCs

-- 1. Borrowing Heatmap Data (Last 56 days)
CREATE OR REPLACE FUNCTION get_borrowing_heatmap_data()
RETURNS TABLE (day DATE, count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CAST(borrowed_at AS DATE) as day,
        COUNT(*) as count
    FROM borrow_records
    WHERE borrowed_at >= NOW() - INTERVAL '56 days'
    GROUP BY day
    ORDER BY day ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Member Retention Stats
CREATE OR REPLACE FUNCTION get_member_retention_stats()
RETURNS JSON AS $$
DECLARE
    total_active INT;
    ret_rate INT;
    avg_dur INT;
    new_mems INT;
BEGIN
    SELECT COUNT(DISTINCT user_id) INTO total_active FROM borrow_records WHERE borrowed_at >= NOW() - INTERVAL '30 days';
    
    SELECT 
        CASE 
            WHEN COUNT(*) = 0 THEN 0 
            ELSE (COUNT(returned_at) * 100 / COUNT(*)) 
        END INTO ret_rate 
    FROM borrow_records 
    WHERE borrowed_at >= NOW() - INTERVAL '60 days';

    SELECT AVG(EXTRACT(DAY FROM (returned_at - borrowed_at)))::INT INTO avg_dur 
    FROM borrow_records 
    WHERE returned_at IS NOT NULL;

    SELECT COUNT(*) INTO new_mems FROM profiles 
    WHERE created_at >= DATE_TRUNC('month', NOW());

    RETURN json_build_object(
        'active_members', COALESCE(total_active, 0),
        'return_rate', COALESCE(ret_rate, 0),
        'avg_borrow_duration', COALESCE(avg_dur, 0),
        'new_members_this_month', COALESCE(new_mems, 0)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Inventory Health Stats
CREATE OR REPLACE FUNCTION get_inventory_health_stats()
RETURNS JSON AS $$
DECLARE
    oos_count INT;
    dead_count INT;
BEGIN
    SELECT COUNT(*) INTO oos_count FROM books WHERE available_copies = 0;
    
    SELECT COUNT(*) INTO dead_count FROM books b
    WHERE NOT EXISTS (
        SELECT 1 FROM borrow_records br 
        WHERE br.book_id = b.isbn AND br.borrow_at >= NOW() - INTERVAL '180 days'
    );

    RETURN json_build_object(
        'out_of_stock_count', COALESCE(oos_count, 0),
        'dead_stock_count', COALESCE(dead_count, 0)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Peak Borrowing Hours
CREATE OR REPLACE FUNCTION get_peak_borrowing_hours()
RETURNS TABLE (hour INT, count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        EXTRACT(HOUR FROM borrowed_at)::INT as hour,
        COUNT(*) as count
    FROM borrow_records
    WHERE borrowed_at >= NOW() - INTERVAL '30 days'
    GROUP BY hour
    ORDER BY hour ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
