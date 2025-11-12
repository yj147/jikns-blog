-- 脚本：检查多态关联数据完整性
-- 用途：在添加 XOR 约束前验证现有数据是否存在违规记录
-- 执行方式：psql -d <database> -f scripts/check-polymorphic-data-integrity.sql

-- ============================================================================
-- Part 1: 检查 Comments 表的数据完整性
-- ============================================================================

\echo '========================================='
\echo '检查 Comments 表的多态关联完整性'
\echo '========================================='

-- 检查同时为空的评论（孤儿评论）
SELECT 
  'Comments - 同时为空' as issue_type,
  COUNT(*) as invalid_count
FROM comments 
WHERE "postId" IS NULL AND "activityId" IS NULL;

-- 检查同时非空的评论（双重归属）
SELECT 
  'Comments - 同时非空' as issue_type,
  COUNT(*) as invalid_count
FROM comments 
WHERE "postId" IS NOT NULL AND "activityId" IS NOT NULL;

-- 显示违规记录的详细信息（最多 10 条）
\echo ''
\echo '违规评论记录示例（最多 10 条）：'
SELECT 
  id,
  "postId",
  "activityId",
  "authorId",
  "createdAt",
  CASE 
    WHEN "postId" IS NULL AND "activityId" IS NULL THEN '同时为空'
    WHEN "postId" IS NOT NULL AND "activityId" IS NOT NULL THEN '同时非空'
  END as violation_type
FROM comments 
WHERE ("postId" IS NULL AND "activityId" IS NULL) 
   OR ("postId" IS NOT NULL AND "activityId" IS NOT NULL)
LIMIT 10;

-- ============================================================================
-- Part 2: 检查 Likes 表的数据完整性
-- ============================================================================

\echo ''
\echo '========================================='
\echo '检查 Likes 表的多态关联完整性'
\echo '========================================='

-- 检查同时为空的点赞（孤儿点赞）
SELECT 
  'Likes - 同时为空' as issue_type,
  COUNT(*) as invalid_count
FROM likes 
WHERE "postId" IS NULL AND "activityId" IS NULL;

-- 检查同时非空的点赞（双重归属）
SELECT 
  'Likes - 同时非空' as issue_type,
  COUNT(*) as invalid_count
FROM likes 
WHERE "postId" IS NOT NULL AND "activityId" IS NOT NULL;

-- 显示违规记录的详细信息（最多 10 条）
\echo ''
\echo '违规点赞记录示例（最多 10 条）：'
SELECT 
  id,
  "postId",
  "activityId",
  "authorId",
  "createdAt",
  CASE 
    WHEN "postId" IS NULL AND "activityId" IS NULL THEN '同时为空'
    WHEN "postId" IS NOT NULL AND "activityId" IS NOT NULL THEN '同时非空'
  END as violation_type
FROM likes 
WHERE ("postId" IS NULL AND "activityId" IS NULL) 
   OR ("postId" IS NOT NULL AND "activityId" IS NOT NULL)
LIMIT 10;

-- ============================================================================
-- Part 3: 生成数据清理建议
-- ============================================================================

\echo ''
\echo '========================================='
\echo '数据清理建议'
\echo '========================================='

DO $$
DECLARE
  invalid_comments_count INT;
  invalid_likes_count INT;
BEGIN
  -- 统计违规记录数量
  SELECT COUNT(*) INTO invalid_comments_count
  FROM comments 
  WHERE ("postId" IS NULL AND "activityId" IS NULL) 
     OR ("postId" IS NOT NULL AND "activityId" IS NOT NULL);
  
  SELECT COUNT(*) INTO invalid_likes_count
  FROM likes 
  WHERE ("postId" IS NULL AND "activityId" IS NULL) 
     OR ("postId" IS NOT NULL AND "activityId" IS NOT NULL);
  
  -- 输出建议
  IF invalid_comments_count > 0 THEN
    RAISE NOTICE '发现 % 条违规评论记录，建议执行以下清理操作：', invalid_comments_count;
    RAISE NOTICE 'DELETE FROM comments WHERE ("postId" IS NULL AND "activityId" IS NULL) OR ("postId" IS NOT NULL AND "activityId" IS NOT NULL);';
  ELSE
    RAISE NOTICE '✓ Comments 表数据完整性检查通过，无违规记录';
  END IF;
  
  IF invalid_likes_count > 0 THEN
    RAISE NOTICE '发现 % 条违规点赞记录，建议执行以下清理操作：', invalid_likes_count;
    RAISE NOTICE 'DELETE FROM likes WHERE ("postId" IS NULL AND "activityId" IS NULL) OR ("postId" IS NOT NULL AND "activityId" IS NOT NULL);';
  ELSE
    RAISE NOTICE '✓ Likes 表数据完整性检查通过，无违规记录';
  END IF;
  
  IF invalid_comments_count = 0 AND invalid_likes_count = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ 所有数据完整性检查通过';
    RAISE NOTICE '可以安全地添加 XOR 约束';
    RAISE NOTICE '========================================';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '⚠ 发现数据完整性问题';
    RAISE NOTICE '请先清理违规数据再添加约束';
    RAISE NOTICE '========================================';
  END IF;
END $$;

-- ============================================================================
-- Part 4: 验证外键引用完整性
-- ============================================================================

\echo ''
\echo '========================================='
\echo '验证外键引用完整性'
\echo '========================================='

-- 检查 Comments 中引用不存在的 Post
SELECT 
  'Comments - 引用不存在的 Post' as issue_type,
  COUNT(*) as invalid_count
FROM comments c
LEFT JOIN posts p ON c."postId" = p.id
WHERE c."postId" IS NOT NULL AND p.id IS NULL;

-- 检查 Comments 中引用不存在的 Activity
SELECT 
  'Comments - 引用不存在的 Activity' as issue_type,
  COUNT(*) as invalid_count
FROM comments c
LEFT JOIN activities a ON c."activityId" = a.id
WHERE c."activityId" IS NOT NULL AND a.id IS NULL;

-- 检查 Likes 中引用不存在的 Post
SELECT 
  'Likes - 引用不存在的 Post' as issue_type,
  COUNT(*) as invalid_count
FROM likes l
LEFT JOIN posts p ON l."postId" = p.id
WHERE l."postId" IS NOT NULL AND p.id IS NULL;

-- 检查 Likes 中引用不存在的 Activity
SELECT 
  'Likes - 引用不存在的 Activity' as issue_type,
  COUNT(*) as invalid_count
FROM likes l
LEFT JOIN activities a ON l."activityId" = a.id
WHERE l."activityId" IS NOT NULL AND a.id IS NULL;

\echo ''
\echo '检查完成！'

