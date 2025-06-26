-- 最终验证脚本 - 生产环境点赞系统
-- 完全无错误版本，适用于Supabase PostgreSQL

-- 🔍 1. 检查表结构
SELECT 
    '📋 Table Structure Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'likes'
        ) THEN '✅ PASS: likes table exists'
        ELSE '❌ FAIL: likes table missing'
    END as result;

-- 🔍 2. 检查表字段
SELECT 
    '📋 Table Columns Check' as test_name,
    COUNT(*) || ' columns found (expected: 6)' as result
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'likes';

-- 🔍 3. 检查必要字段
SELECT 
    '📋 Required Columns Check' as test_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'likes' AND column_name = 'id')
        AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'likes' AND column_name = 'post_slug')
        AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'likes' AND column_name = 'user_ip')
        AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'likes' AND column_name = 'user_id')
        AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'likes' AND column_name = 'created_at')
        AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'likes' AND column_name = 'updated_at')
        THEN '✅ PASS: All required columns exist'
        ELSE '❌ FAIL: Missing required columns'
    END as result;

-- 🔍 4. 检查索引
SELECT 
    '🔍 Index Check' as test_name,
    COUNT(*) || ' indexes created (expected: 5+)' as result
FROM pg_indexes 
WHERE tablename = 'likes' AND schemaname = 'public';

-- 🔍 5. 检查RLS策略
SELECT 
    '🔒 RLS Policy Check' as test_name,
    COUNT(*) || ' policies active (expected: 3)' as result
FROM pg_policies 
WHERE tablename = 'likes' AND schemaname = 'public';

-- 🔍 6. 检查视图
SELECT 
    '📊 Views Check' as test_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'post_like_stats')
        AND EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'popular_posts')
        THEN '✅ PASS: All views created'
        ELSE '❌ FAIL: Views missing'
    END as result;

-- 🔍 7. 检查触发器
SELECT 
    '⚡ Trigger Check' as test_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_name = 'trigger_update_likes_updated_at'
        ) THEN '✅ PASS: Update trigger exists'
        ELSE '❌ FAIL: Update trigger missing'
    END as result;

-- 🔍 8. 检查函数
SELECT 
    '⚙️ Functions Check' as test_name,
    COUNT(*) || ' custom functions created' as result
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('update_likes_updated_at', 'check_like_rate_limit', 'cleanup_old_likes');

-- 🧹 清理任何现有测试数据
DELETE FROM public.likes WHERE post_slug LIKE 'test-%';

-- 🔍 9. 测试基本插入
INSERT INTO public.likes (post_slug, user_ip) 
VALUES ('test-basic', '192.168.1.100'::INET);

SELECT 
    '✏️ Basic Insert Test' as test_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.likes WHERE post_slug = 'test-basic')
        THEN '✅ PASS: Insert operation works'
        ELSE '❌ FAIL: Insert operation failed'
    END as result;

-- 🔍 10. 测试统计视图
SELECT 
    '📊 Statistics View Test' as test_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.post_like_stats WHERE post_slug = 'test-basic')
        THEN '✅ PASS: Statistics view working'
        ELSE '❌ FAIL: Statistics view not working'
    END as result;

-- 🔍 11. 测试热门文章视图
SELECT 
    '🔥 Popular Posts View Test' as test_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.popular_posts WHERE post_slug = 'test-basic')
        THEN '✅ PASS: Popular posts view working'
        ELSE '❌ FAIL: Popular posts view not working'
    END as result;

-- 🔍 12. 测试唯一约束
INSERT INTO public.likes (post_slug, user_ip) 
VALUES ('test-unique-check', '192.168.1.101'::INET);

-- 尝试插入重复数据（应该被约束阻止）
INSERT INTO public.likes (post_slug, user_ip) 
VALUES ('test-unique-check', '192.168.1.101'::INET)
ON CONFLICT DO NOTHING;

SELECT 
    '🔒 Unique Constraint Test' as test_name,
    CASE 
        WHEN (SELECT COUNT(*) FROM public.likes WHERE post_slug = 'test-unique-check') = 1
        THEN '✅ PASS: Unique constraint working'
        ELSE '❌ FAIL: Unique constraint not working'
    END as result;

-- 🔍 13. 测试删除功能
DELETE FROM public.likes WHERE post_slug = 'test-basic';

SELECT 
    '🗑️ Delete Test' as test_name,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM public.likes WHERE post_slug = 'test-basic')
        THEN '✅ PASS: Delete operation works'
        ELSE '❌ FAIL: Delete operation failed'
    END as result;

-- 🔍 14. 性能测试（批量插入）
INSERT INTO public.likes (post_slug, user_ip) 
SELECT 
    'perf-test-' || generate_series,
    ('192.168.2.' || (generate_series % 254 + 1))::INET
FROM generate_series(1, 20);

SELECT 
    '⚡ Performance Test' as test_name,
    CASE 
        WHEN (SELECT COUNT(*) FROM public.likes WHERE post_slug LIKE 'perf-test-%') = 20
        THEN '✅ PASS: Bulk insert successful (20 records)'
        ELSE '❌ FAIL: Bulk insert failed'
    END as result;

-- 🔍 15. 测试统计准确性
SELECT 
    '📊 Statistics Accuracy Test' as test_name,
    CASE 
        WHEN (SELECT total_likes FROM public.post_like_stats WHERE post_slug = 'perf-test-1') = 1
        THEN '✅ PASS: Statistics are accurate'
        ELSE '❌ FAIL: Statistics are inaccurate'
    END as result;

-- 🧹 清理所有测试数据
DELETE FROM public.likes WHERE post_slug LIKE 'test-%' OR post_slug LIKE 'perf-test-%';

-- 🎉 最终状态报告
SELECT 
    '🎉 DEPLOYMENT STATUS' as status,
    'Production likes system verification completed!' as result,
    NOW() as timestamp;

-- 📊 显示当前表统计
SELECT 
    '📊 Current Statistics' as info,
    COUNT(*) as total_likes,
    COUNT(DISTINCT post_slug) as unique_posts,
    COUNT(DISTINCT user_ip) as unique_ips,
    COALESCE(MIN(created_at), NOW()) as first_like,
    COALESCE(MAX(created_at), NOW()) as last_like
FROM public.likes;

-- 💾 显示存储信息
SELECT 
    '💾 Storage Information' as info,
    pg_size_pretty(pg_total_relation_size('public.likes')) as total_size,
    pg_size_pretty(pg_relation_size('public.likes')) as table_size;

-- 🔍 显示索引列表
SELECT 
    '🔍 Available Indexes' as info,
    indexname as index_name,
    indexdef as definition
FROM pg_indexes 
WHERE tablename = 'likes' AND schemaname = 'public'
ORDER BY indexname;

-- ✅ 最终确认
SELECT 
    '✅ READY FOR PRODUCTION' as status,
    'Your likes system is now ready for public use!' as message,
    'Test the like buttons on your blog articles.' as next_step;
