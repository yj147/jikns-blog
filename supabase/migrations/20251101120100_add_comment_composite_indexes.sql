-- Migration: Add Composite Indexes for Comment Queries
-- Purpose: Optimize top-level comment and reply queries
-- Date: 2025-11-01
-- Priority: P2 - Performance optimization

-- ============================================================================
-- Part 1: Add Composite Index for Post Top-Level Comments
-- ============================================================================

-- 覆盖查询：WHERE postId = ? AND parentId IS NULL ORDER BY createdAt DESC, id DESC
CREATE INDEX IF NOT EXISTS "comments_postId_parentId_createdAt_id_idx"
ON "comments" ("postId", "parentId", "createdAt" DESC, "id" DESC);

-- ============================================================================
-- Part 2: Add Composite Index for Activity Top-Level Comments
-- ============================================================================

-- 覆盖查询：WHERE activityId = ? AND parentId IS NULL ORDER BY createdAt DESC, id DESC
CREATE INDEX IF NOT EXISTS "comments_activityId_parentId_createdAt_id_idx"
ON "comments" ("activityId", "parentId", "createdAt" DESC, "id" DESC);

-- ============================================================================
-- Part 3: Add Composite Index for Reply Queries
-- ============================================================================

-- 覆盖查询：WHERE parentId IN (...) ORDER BY createdAt ASC, id ASC
CREATE INDEX IF NOT EXISTS "comments_parentId_createdAt_id_asc_idx"
ON "comments" ("parentId", "createdAt" ASC, "id" ASC);

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 20251101120100 completed';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '  1. Added composite index for post top-level comments';
  RAISE NOTICE '  2. Added composite index for activity top-level comments';
  RAISE NOTICE '  3. Added composite index for reply queries';
  RAISE NOTICE '';
  RAISE NOTICE 'Performance Impact:';
  RAISE NOTICE '  - Top-level comment queries: Index scan instead of sequential scan';
  RAISE NOTICE '  - Reply loading: Optimized batch query with parentId IN (...)';
  RAISE NOTICE '  - Cursor pagination: Efficient ORDER BY with composite index';
  RAISE NOTICE '';
  RAISE NOTICE 'Index Details:';
  RAISE NOTICE '  - comments_postId_parentId_createdAt_id_idx';
  RAISE NOTICE '    Covers: WHERE postId = ? AND parentId IS NULL ORDER BY createdAt DESC, id DESC';
  RAISE NOTICE '  - comments_activityId_parentId_createdAt_id_idx';
  RAISE NOTICE '    Covers: WHERE activityId = ? AND parentId IS NULL ORDER BY createdAt DESC, id DESC';
  RAISE NOTICE '  - comments_parentId_createdAt_id_asc_idx';
  RAISE NOTICE '    Covers: WHERE parentId IN (...) ORDER BY createdAt ASC, id ASC';
  RAISE NOTICE '';
  RAISE NOTICE 'Rollback:';
  RAISE NOTICE '  DROP INDEX IF EXISTS "comments_postId_parentId_createdAt_id_idx";';
  RAISE NOTICE '  DROP INDEX IF EXISTS "comments_activityId_parentId_createdAt_id_idx";';
  RAISE NOTICE '  DROP INDEX IF EXISTS "comments_parentId_createdAt_id_asc_idx";';
  RAISE NOTICE '========================================';
END $$;

