-- 任务：将 activity-images bucket 从公开读取改为私有，并为签名 URL 流程预留最小读取策略
-- 目标：
--   1) 移除公共读取策略，防止匿名直接访问
--   2) 允许已认证用户按路径规则读取自己的文件（便于必要的服务器端校验）
--   3) 维持现有上传/更新/删除策略与路径约束

-- 1) 将 bucket 标记为私有
UPDATE storage.buckets
SET public = FALSE
WHERE id = 'activity-images';

-- 2) 清理旧的公共读取策略
DROP POLICY IF EXISTS "Enable public view for activity-images" ON storage.objects;
DROP POLICY IF EXISTS "Enable public read access on activity-images bucket" ON storage.buckets;

-- 3) 重新创建读取策略：仅认证用户读取自身文件
-- 支持三种路径前缀：
--   a) {user_id}/...
--   b) activities/{user_id}/...
--   c) avatars/{user_id}/...
CREATE POLICY "Enable authenticated read own files in activity-images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'activity-images'
  AND auth.role() = 'authenticated'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (
      (storage.foldername(name))[1] = 'activities'
      AND (storage.foldername(name))[2] = auth.uid()::text
    )
    OR (
      (storage.foldername(name))[1] = 'avatars'
      AND (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);

-- 4) bucket 元数据仅对已认证用户开放
CREATE POLICY "Enable authenticated read access on activity-images bucket"
ON storage.buckets
FOR SELECT
TO authenticated
USING (id = 'activity-images');

-- 注：上传/更新/删除策略沿用既有版本，不再重复创建；签名 URL 生成将使用 service_role 以绕过 RLS
