-- T6: 重新私有化 activity-images bucket，移除匿名读取并仅允许认证用户读取自己的文件

-- 1) 强制 bucket 为私有
UPDATE storage.buckets
SET public = FALSE
WHERE id = 'activity-images';

-- 2) 移除公共读取策略（objects + bucket 元数据）
DROP POLICY IF EXISTS "Enable public view for activity-images" ON storage.objects;
DROP POLICY IF EXISTS "Enable public read access on activity-images bucket" ON storage.buckets;

-- 3) 仅允许认证用户按路径读取自己的文件
DROP POLICY IF EXISTS "Enable authenticated read own files in activity-images" ON storage.objects;

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
    OR (
      (storage.foldername(name))[1] = 'covers'
      AND (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);

-- 4) bucket 元数据仅对认证用户开放
DROP POLICY IF EXISTS "Enable authenticated read access on activity-images bucket" ON storage.buckets;

CREATE POLICY "Enable authenticated read access on activity-images bucket"
ON storage.buckets
FOR SELECT
TO authenticated
USING (id = 'activity-images');
