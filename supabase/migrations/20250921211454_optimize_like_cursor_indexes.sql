-- 优化 Like 表的游标分页索引
-- 当前索引 (createdAt, id) 无法有效支持 WHERE postId/activityId 的查询
-- 需要创建复合索引让查询能够利用索引覆盖

-- 1. 删除旧的无效索引
DROP INDEX IF EXISTS "likes_createdAt_id_idx";
DROP INDEX IF EXISTS "likes_postId_idx";
DROP INDEX IF EXISTS "likes_activityId_idx";

-- 2. 创建新的复合索引，支持基于 postId 的游标分页
-- 覆盖查询: WHERE postId = ? ORDER BY createdAt DESC, id DESC
CREATE INDEX "likes_postId_createdAt_id_idx" 
ON public.likes 
USING btree ("postId", "createdAt" DESC, id DESC)
WHERE "postId" IS NOT NULL;

-- 3. 创建新的复合索引，支持基于 activityId 的游标分页
-- 覆盖查询: WHERE activityId = ? ORDER BY createdAt DESC, id DESC
CREATE INDEX "likes_activityId_createdAt_id_idx" 
ON public.likes 
USING btree ("activityId", "createdAt" DESC, id DESC)
WHERE "activityId" IS NOT NULL;

-- 4. 保留 authorId 索引用于用户点赞记录查询
CREATE INDEX IF NOT EXISTS "likes_authorId_idx" 
ON public.likes 
USING btree ("authorId");