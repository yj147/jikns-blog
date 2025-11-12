-- Migration: Simplify XOR Constraints using num_nonnulls()
-- Description: Replace boolean-to-int casting with PostgreSQL's built-in num_nonnulls() function
-- Author: Activity Module Improvement - P2 Optimization
-- Date: 2025-10-31

-- ========================================
-- Step 1: Drop existing XOR constraints
-- ========================================

ALTER TABLE "comments" DROP CONSTRAINT IF EXISTS "comments_target_xor_check";
ALTER TABLE "likes" DROP CONSTRAINT IF EXISTS "likes_target_xor_check";

-- ========================================
-- Step 2: Add simplified XOR constraints using num_nonnulls()
-- ========================================

-- Comment XOR constraint: exactly one of postId or activityId must be non-null
ALTER TABLE "comments" ADD CONSTRAINT "comments_target_xor_check"
  CHECK (num_nonnulls("postId", "activityId") = 1);

-- Like XOR constraint: exactly one of postId or activityId must be non-null
ALTER TABLE "likes" ADD CONSTRAINT "likes_target_xor_check"
  CHECK (num_nonnulls("postId", "activityId") = 1);

-- ========================================
-- Verification
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '✓ XOR constraints simplified successfully';
  RAISE NOTICE '  - comments_target_xor_check: now uses num_nonnulls()';
  RAISE NOTICE '  - likes_target_xor_check: now uses num_nonnulls()';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 20251031175722 completed';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '  1. Replaced boolean-to-int casting with num_nonnulls()';
  RAISE NOTICE '  2. Improved constraint readability';
  RAISE NOTICE '  3. Maintained identical functionality';
  RAISE NOTICE '';
  RAISE NOTICE 'Impact:';
  RAISE NOTICE '  - No behavioral changes';
  RAISE NOTICE '  - Cleaner constraint definitions';
  RAISE NOTICE '  - Better PostgreSQL idiom';
  RAISE NOTICE '';
  RAISE NOTICE 'Rollback:';
  RAISE NOTICE '  ALTER TABLE comments DROP CONSTRAINT comments_target_xor_check;';
  RAISE NOTICE '  ALTER TABLE likes DROP CONSTRAINT likes_target_xor_check;';
  RAISE NOTICE '  -- Then re-apply old constraints from migration 20251101000000';
  RAISE NOTICE '========================================';
END $$;
