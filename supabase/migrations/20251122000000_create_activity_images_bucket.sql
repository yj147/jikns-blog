-- 创建 activity-images bucket 及 RLS 策略，保持与 post-images 相同的权限模型

-- 1. 确保 bucket 存在（公共、50MB、限定图片格式），重复运行时更新配置
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'activity-images',
  'activity-images',
  true,          -- 公共访问
  52428800,      -- 50MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. 清理可能存在的旧策略
DROP POLICY IF EXISTS "Enable authenticated upload to activity-images" ON storage.objects;
DROP POLICY IF EXISTS "Enable public view for activity-images" ON storage.objects;
DROP POLICY IF EXISTS "Enable authenticated update own files in activity-images" ON storage.objects;
DROP POLICY IF EXISTS "Enable authenticated delete own files in activity-images" ON storage.objects;
DROP POLICY IF EXISTS "Enable public read access on activity-images bucket" ON storage.buckets;

-- 3. 重新创建 RLS 策略

-- 允许已认证用户上传到 activity-images
CREATE POLICY "Enable authenticated upload to activity-images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'activity-images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'activities'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- 允许公共读取 activity-images
CREATE POLICY "Enable public view for activity-images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'activity-images');

-- 允许文件所有者更新文件
CREATE POLICY "Enable authenticated update own files in activity-images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'activity-images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'activities'
  AND (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'activity-images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'activities'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- 允许文件所有者删除自己的文件
CREATE POLICY "Enable authenticated delete own files in activity-images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'activity-images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'activities'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- 4. bucket 元数据公共只读
CREATE POLICY "Enable public read access on activity-images bucket"
ON storage.buckets
FOR SELECT
TO public
USING (id = 'activity-images');
