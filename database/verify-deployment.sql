-- 生产环境部署验证脚本
-- 用于验证点赞系统是否正确部署

-- 1. 检查表结构
SELECT 
    'Table Structure Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'likes'
        ) THEN 'PASS: likes table exists'
        ELSE 'FAIL: likes table missing'
    END as result;

-- 2. 检查索引
SELECT 
    'Index Check' as test_name,
    COUNT(*) || ' indexes created' as result
FROM pg_indexes 
WHERE tablename = 'likes' AND schemaname = 'public';

-- 3. 检查RLS策略
SELECT 
    'RLS Policy Check' as test_name,
    COUNT(*) || ' policies active' as result
FROM pg_policies 
WHERE tablename = 'likes' AND schemaname = 'public';

-- 4. 检查视图
SELECT 
    'Views Check' as test_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'post_like_stats')
        AND EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'popular_posts')
        THEN 'PASS: All views created'
        ELSE 'FAIL: Views missing'
    END as result;

-- 5. 检查触发器
SELECT 
    'Trigger Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_name = 'trigger_update_likes_updated_at'
        ) THEN 'PASS: Update trigger exists'
        ELSE 'FAIL: Update trigger missing'
    END as result;

-- 6. 测试插入功能
DO $$
DECLARE
    test_result TEXT;
BEGIN
    BEGIN
        -- 尝试插入测试数据
        INSERT INTO public.likes (post_slug, user_ip)
        VALUES ('test-insert', '192.168.1.1'::INET);

        -- 检查是否插入成功
        IF EXISTS (SELECT 1 FROM public.likes WHERE post_slug = 'test-insert') THEN
            test_result := 'PASS: Insert operation works';
        ELSE
            test_result := 'FAIL: Insert operation failed';
        END IF;

        -- 清理测试数据
        DELETE FROM public.likes WHERE post_slug = 'test-insert';

    EXCEPTION
        WHEN OTHERS THEN
            test_result := 'FAIL: Insert operation error - ' || SQLERRM;
    END;

    RAISE NOTICE 'Insert Test: %', test_result;
END $$;

-- 7. 测试唯一约束
DO $$
DECLARE
    test_result TEXT;
BEGIN
    BEGIN
        -- 插入第一条记录
        INSERT INTO public.likes (post_slug, user_ip)
        VALUES ('test-unique', '192.168.1.2'::INET);

        -- 尝试插入重复记录
        INSERT INTO public.likes (post_slug, user_ip)
        VALUES ('test-unique', '192.168.1.2'::INET);

        test_result := 'FAIL: Unique constraint not working';

    EXCEPTION
        WHEN unique_violation THEN
            test_result := 'PASS: Unique constraint working';
        WHEN OTHERS THEN
            test_result := 'FAIL: Unique constraint test error - ' || SQLERRM;
    END;

    -- 清理测试数据
    DELETE FROM public.likes WHERE post_slug = 'test-unique';

    RAISE NOTICE 'Unique Constraint Test: %', test_result;
END $$;

-- 8. 测试统计视图
DO $$
DECLARE
    test_result TEXT;
    stats_count INTEGER;
BEGIN
    BEGIN
        -- 插入测试数据
        INSERT INTO public.likes (post_slug, user_ip)
        VALUES ('test-stats', '192.168.1.3'::INET);

        -- 检查统计视图
        SELECT COUNT(*) INTO stats_count
        FROM public.post_like_stats
        WHERE post_slug = 'test-stats';

        IF stats_count > 0 THEN
            test_result := 'PASS: Statistics view working';
        ELSE
            test_result := 'FAIL: Statistics view not working';
        END IF;

        -- 清理测试数据
        DELETE FROM public.likes WHERE post_slug = 'test-stats';

    EXCEPTION
        WHEN OTHERS THEN
            test_result := 'FAIL: Statistics view test error - ' || SQLERRM;
    END;

    RAISE NOTICE 'Statistics View Test: %', test_result;
END $$;

-- 9. 性能测试（插入100条记录）
DO $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    duration INTERVAL;
    i INTEGER;
BEGIN
    start_time := clock_timestamp();
    
    -- 插入100条测试记录
    FOR i IN 1..100 LOOP
        INSERT INTO public.likes (post_slug, user_ip) 
        VALUES ('perf-test-' || i, ('192.168.1.' || (i % 254 + 1))::INET)
        ON CONFLICT DO NOTHING;
    END LOOP;
    
    end_time := clock_timestamp();
    duration := end_time - start_time;
    
    RAISE NOTICE 'Performance Test: Inserted 100 records in %', duration;
    
    -- 清理测试数据
    DELETE FROM public.likes WHERE post_slug LIKE 'perf-test-%';
END $$;

-- 10. 最终状态检查
SELECT 
    'Final Status' as test_name,
    'Deployment verification completed' as result,
    NOW() as timestamp;

-- 显示当前表统计
SELECT 
    'Current Statistics' as info,
    COUNT(*) as total_likes,
    COUNT(DISTINCT post_slug) as unique_posts,
    COUNT(DISTINCT user_ip) as unique_ips,
    MIN(created_at) as first_like,
    MAX(created_at) as last_like
FROM public.likes;
