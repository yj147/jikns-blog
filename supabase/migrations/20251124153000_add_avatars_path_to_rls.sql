-- 扩展 activity-images bucket 的 RLS：允许 avatars/{user_id}/ 路径
-- 背景：头像上传路径为 avatars/{user_id}/...，现有策略仅放行 {user_id}/... 与 activities/{user_id}/...

-- 1) 清理旧策略，使用相同名称重建
DROP POLICY IF EXISTS "Enable authenticated upload to activity-images" ON storage.objects;
DROP POLICY IF EXISTS "Enable authenticated update own files in activity-images" ON storage.objects;
DROP POLICY IF EXISTS "Enable authenticated delete own files in activity-images" ON storage.objects;

-- 公共条件：允许三种路径形态
--   a) {user_id}/...
--   b) activities/{user_id}/...
--   c) avatars/{user_id}/...
-- 使用 auth.uid() 与路径段匹配，限制到 activity-images bucket

-- 2) 上传：已认证用户只能写入自己的目录（含头像路径）
CREATE POLICY "Enable authenticated upload to activity-images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
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

-- 3) 更新：仅允许文件所属用户（含头像路径）
CREATE POLICY "Enable authenticated update own files in activity-images"
ON storage.objects
FOR UPDATE
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
)
WITH CHECK (
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

-- 4) 删除：仅允许文件所属用户（含头像路径）
CREATE POLICY "Enable authenticated delete own files in activity-images"
ON storage.objects
FOR DELETE
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

-- 读取策略保持不变：公共可读
