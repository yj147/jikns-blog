-- 为 activity-images bucket 添加 covers/{user_id}/ 路径支持

-- 1) 更新 SELECT 策略：允许读取自己的 covers
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

-- 2) 添加 INSERT 策略：允许上传到 covers/{user_id}/
DROP POLICY IF EXISTS "Enable authenticated upload covers in activity-images" ON storage.objects;

CREATE POLICY "Enable authenticated upload covers in activity-images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'activity-images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'covers'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- 3) 添加 UPDATE 策略：允许更新自己的 covers
DROP POLICY IF EXISTS "Enable authenticated update covers in activity-images" ON storage.objects;

CREATE POLICY "Enable authenticated update covers in activity-images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'activity-images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'covers'
  AND (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'activity-images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'covers'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- 4) 添加 DELETE 策略：允许删除自己的 covers
DROP POLICY IF EXISTS "Enable authenticated delete covers in activity-images" ON storage.objects;

CREATE POLICY "Enable authenticated delete covers in activity-images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'activity-images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'covers'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
