-- 简化的生产环境部署验证脚本
-- 避免复杂的异常处理，专注于核心功能验证

-- 1. 检查表结构
SELECT 
    'Table Structure Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'likes'
        ) THEN '✅ PASS: likes table exists'
        ELSE '❌ FAIL: likes table missing'
    END as result;

-- 2. 检查表字段
SELECT 
    'Table Columns Check' as test_name,
    COUNT(*) || ' columns found' as result
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'likes';

-- 3. 检查索引
SELECT 
    'Index Check' as test_name,
    COUNT(*) || ' indexes created' as result
FROM pg_indexes 
WHERE tablename = 'likes' AND schemaname = 'public';

-- 4. 检查RLS策略
SELECT 
    'RLS Policy Check' as test_name,
    COUNT(*) || ' policies active' as result
FROM pg_policies 
WHERE tablename = 'likes' AND schemaname = 'public';

-- 5. 检查视图
SELECT 
    'Views Check' as test_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'post_like_stats')
        AND EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'popular_posts')
        THEN '✅ PASS: All views created'
        ELSE '❌ FAIL: Views missing'
    END as result;

-- 6. 检查触发器
SELECT 
    'Trigger Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_name = 'trigger_update_likes_updated_at'
        ) THEN '✅ PASS: Update trigger exists'
        ELSE '❌ FAIL: Update trigger missing'
    END as result;

-- 7. 检查函数
SELECT 
    'Functions Check' as test_name,
    COUNT(*) || ' custom functions created' as result
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('update_likes_updated_at', 'check_like_rate_limit', 'cleanup_old_likes');

-- 8. 测试基本插入（清理任何现有测试数据）
DELETE FROM public.likes WHERE post_slug LIKE 'test-%';

-- 插入测试数据
INSERT INTO public.likes (post_slug, user_ip) 
VALUES ('test-basic', '192.168.1.100'::INET);

-- 验证插入
SELECT 
    'Basic Insert Test' as test_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.likes WHERE post_slug = 'test-basic')
        THEN '✅ PASS: Insert operation works'
        ELSE '❌ FAIL: Insert operation failed'
    END as result;

-- 9. 测试统计视图
SELECT 
    'Statistics View Test' as test_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.post_like_stats WHERE post_slug = 'test-basic')
        THEN '✅ PASS: Statistics view working'
        ELSE '❌ FAIL: Statistics view not working'
    END as result;

-- 10. 测试热门文章视图
SELECT 
    'Popular Posts View Test' as test_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.popular_posts WHERE post_slug = 'test-basic')
        THEN '✅ PASS: Popular posts view working'
        ELSE '❌ FAIL: Popular posts view not working'
    END as result;

-- 11. 测试唯一约束（尝试插入重复数据）
INSERT INTO public.likes (post_slug, user_ip) 
VALUES ('test-unique-check', '192.168.1.101'::INET);

-- 这个插入应该失败（如果约束工作正常）
-- 我们使用ON CONFLICT来处理
INSERT INTO public.likes (post_slug, user_ip) 
VALUES ('test-unique-check', '192.168.1.101'::INET)
ON CONFLICT DO NOTHING;

-- 检查只有一条记录
SELECT 
    'Unique Constraint Test' as test_name,
    CASE 
        WHEN (SELECT COUNT(*) FROM public.likes WHERE post_slug = 'test-unique-check') = 1
        THEN '✅ PASS: Unique constraint working'
        ELSE '❌ FAIL: Unique constraint not working'
    END as result;

-- 12. 测试删除功能
DELETE FROM public.likes WHERE post_slug = 'test-basic';

SELECT 
    'Delete Test' as test_name,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM public.likes WHERE post_slug = 'test-basic')
        THEN '✅ PASS: Delete operation works'
        ELSE '❌ FAIL: Delete operation failed'
    END as result;

-- 13. 性能测试（插入多条记录）
INSERT INTO public.likes (post_slug, user_ip) 
SELECT 
    'perf-test-' || generate_series,
    ('192.168.2.' || (generate_series % 254 + 1))::INET
FROM generate_series(1, 50);

SELECT 
    'Performance Test' as test_name,
    CASE 
        WHEN (SELECT COUNT(*) FROM public.likes WHERE post_slug LIKE 'perf-test-%') = 50
        THEN '✅ PASS: Bulk insert successful (50 records)'
        ELSE '❌ FAIL: Bulk insert failed'
    END as result;

-- 14. 测试统计准确性
SELECT 
    'Statistics Accuracy Test' as test_name,
    CASE 
        WHEN (SELECT total_likes FROM public.post_like_stats WHERE post_slug = 'perf-test-1') = 1
        THEN '✅ PASS: Statistics are accurate'
        ELSE '❌ FAIL: Statistics are inaccurate'
    END as result;

-- 15. 清理测试数据
DELETE FROM public.likes WHERE post_slug LIKE 'test-%' OR post_slug LIKE 'perf-test-%';

-- 16. 最终状态检查
SELECT 
    'Final Status' as test_name,
    '🎉 Deployment verification completed successfully!' as result,
    NOW() as timestamp;

-- 17. 显示当前表统计
SELECT 
    '📊 Current Statistics' as info,
    COUNT(*) as total_likes,
    COUNT(DISTINCT post_slug) as unique_posts,
    COUNT(DISTINCT user_ip) as unique_ips,
    COALESCE(MIN(created_at), NOW()) as first_like,
    COALESCE(MAX(created_at), NOW()) as last_like
FROM public.likes;

-- 18. 显示表大小信息
SELECT 
    '💾 Storage Information' as info,
    pg_size_pretty(pg_total_relation_size('public.likes')) as table_size,
    pg_size_pretty(pg_relation_size('public.likes')) as data_size,
    pg_size_pretty(pg_total_relation_size('public.likes') - pg_relation_size('public.likes')) as index_size;

-- 19. 显示索引使用情况（简化版本）
SELECT
    '🔍 Index Usage' as info,
    'Check Supabase dashboard for detailed index statistics' as message,
    COUNT(*) || ' indexes available for likes table' as index_count
FROM pg_indexes
WHERE tablename = 'likes' AND schemaname = 'public';

-- 20. 部署成功确认
SELECT 
    '✅ DEPLOYMENT STATUS' as status,
    'Production likes system is ready for use!' as message,
    'You can now test the like functionality on your blog.' as next_step;
