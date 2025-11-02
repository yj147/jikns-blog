-- Create Storage bucket for image uploads
-- Phase 5.1.4 - Fix image upload issue: create missing post-images bucket

-- Create post-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-images',
  'post-images', 
  true,  -- Set as public to allow public access
  10485760,  -- 10MB file size limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;  -- Ignore if already exists

-- Set Storage access policies, allow authenticated users to upload
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users to upload images' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Allow authenticated users to upload images" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'post-images');
  END IF;
END $$;

-- Allow everyone to view images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow public to view images' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Allow public to view images" ON storage.objects
      FOR SELECT TO public
      USING (bucket_id = 'post-images');
  END IF;
END $$;

-- Allow authenticated users to delete their own uploaded images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users to delete own images' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Allow authenticated users to delete own images" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'post-images' AND owner = auth.uid());
  END IF;
END $$;