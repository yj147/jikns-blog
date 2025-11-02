-- 修复 Storage RLS 策略配置
-- 解决 Storage RLS 权限问题和上传失败问题

-- 1. 删除现有可能冲突的策略
DROP POLICY IF EXISTS "Allow authenticated users to upload images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public to view images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete own images" ON storage.objects;

-- 2. 确保 post-images bucket 存在并配置正确
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-images',
  'post-images', 
  true,  -- 公共访问
  52428800,  -- 50MB 文件大小限制 (更大的限制)
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. 重新创建增强的 RLS 策略

-- 允许已认证用户上传到 post-images bucket
CREATE POLICY "Enable authenticated upload to post-images"
ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'post-images' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 允许公共访问查看 post-images 中的文件
CREATE POLICY "Enable public view for post-images"
ON storage.objects
FOR SELECT 
TO public
USING (bucket_id = 'post-images');

-- 允许文件所有者更新文件
CREATE POLICY "Enable authenticated update own files in post-images"
ON storage.objects
FOR UPDATE 
TO authenticated
USING (
  bucket_id = 'post-images' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'post-images' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 允许文件所有者删除自己的文件
CREATE POLICY "Enable authenticated delete own files in post-images"
ON storage.objects
FOR DELETE 
TO authenticated
USING (
  bucket_id = 'post-images' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. 确保 RLS 已启用
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- 5. 创建 bucket 访问策略
CREATE POLICY IF NOT EXISTS "Enable public read access on post-images bucket"
ON storage.buckets
FOR SELECT 
TO public
USING (id = 'post-images');

-- 6. 授予必要的权限
GRANT USAGE ON SCHEMA storage TO authenticated, anon;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;
GRANT SELECT ON storage.objects TO anon;
GRANT SELECT ON storage.buckets TO anon;

-- 7. 创建辅助函数用于调试 (可选)
CREATE OR REPLACE FUNCTION debug_storage_access()
RETURNS TABLE(
  current_role text,
  current_user_id text,
  bucket_policies text[],
  object_policies text[]
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY 
  SELECT 
    auth.role()::text,
    auth.uid()::text,
    ARRAY(SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'buckets'),
    ARRAY(SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects');
END;
$$;

-- 注释：这个迁移解决了以下问题：
-- 1. 更明确的 RLS 策略，使用 auth.role() 和 auth.uid() 进行权限检查
-- 2. 使用文件夹结构权限控制 (用户只能访问自己文件夹)
-- 3. 增加文件大小限制到 50MB
-- 4. 包含更多支持的图片格式
-- 5. 明确的权限授予语句
-- 6. 调试辅助函数便于排查权限问题