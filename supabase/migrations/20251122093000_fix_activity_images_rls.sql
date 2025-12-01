-- 修复 activity-images bucket 的 RLS：允许用户以两种路径模式上传自己的文件
-- 背景：现有策略要求路径为 activities/{user_id}/...，导致直接以 {user_id}/... 上传时触发 RLS 失败

-- 1) 确保 bucket 配置存在且保持期望参数
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'activity-images',
  'activity-images',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2) 清理旧策略
DROP POLICY IF EXISTS "Enable authenticated upload to activity-images" ON storage.objects;
DROP POLICY IF EXISTS "Enable public view for activity-images" ON storage.objects;
DROP POLICY IF EXISTS "Enable authenticated update own files in activity-images" ON storage.objects;
DROP POLICY IF EXISTS "Enable authenticated delete own files in activity-images" ON storage.objects;
DROP POLICY IF EXISTS "Enable public read access on activity-images bucket" ON storage.buckets;

-- 公共条件：允许两种路径形态
--   a) {user_id}/...（直接以用户 ID 作为根目录）
--   b) activities/{user_id}/...（历史/兼容路径）
-- 使用 auth.uid() 与路径段匹配，限制到 bucket

-- 3) 上传：已认证用户只能写入自己的目录
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
  )
);

-- 4) 读取：公众可读
CREATE POLICY "Enable public view for activity-images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'activity-images');

-- 5) 更新：仅允许文件所属用户
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
  )
);

-- 6) 删除：仅允许文件所属用户
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
  )
);

-- 7) bucket 元数据公共只读
CREATE POLICY "Enable public read access on activity-images bucket"
ON storage.buckets
FOR SELECT
TO public
USING (id = 'activity-images');
