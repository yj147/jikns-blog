-- 将 post-images bucket 设为私有并切换到签名 URL 访问

-- 1) 将 bucket 标记为私有
UPDATE storage.buckets
SET public = FALSE
WHERE id = 'post-images';

-- 2) 移除公开读取策略（兼容历史命名）
DROP POLICY IF EXISTS "Public read access for post-images" ON storage.objects;
DROP POLICY IF EXISTS "post-images public select" ON storage.objects;
DROP POLICY IF EXISTS "Enable public view for post-images" ON storage.objects;
DROP POLICY IF EXISTS "Enable public read access on post-images bucket" ON storage.buckets;

-- 3) 添加认证用户读取策略（上传/更新/删除策略沿用既有版本）
CREATE POLICY "Authenticated read for post-images"
ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'post-images');

-- 4) bucket 元数据仅对认证用户可见
CREATE POLICY "Authenticated bucket read for post-images"
ON storage.buckets
FOR SELECT TO authenticated
USING (id = 'post-images');

-- ============================================================================
-- DOWN MIGRATION (回滚脚本)
-- ============================================================================
-- 如需回滚，执行以下 SQL：
--
-- -- 1) 恢复 bucket 为公开
-- UPDATE storage.buckets SET public = TRUE WHERE id = 'post-images';
--
-- -- 2) 移除认证读取策略
-- DROP POLICY IF EXISTS "Authenticated read for post-images" ON storage.objects;
-- DROP POLICY IF EXISTS "Authenticated bucket read for post-images" ON storage.buckets;
--
-- -- 3) 恢复公开读取策略
-- CREATE POLICY "Public read access for post-images"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'post-images');
--
-- 注意：回滚后现有签名 URL 仍可用，公开 URL 恢复访问
-- ============================================================================
