-- 强制执行 Tag 模型的列长度约束
-- 确保数据库结构与 Prisma schema 定义一致

-- 1. 检查并截断超长数据（如果存在）
UPDATE tags
SET name = LEFT(name, 50)
WHERE LENGTH(name) > 50;

UPDATE tags
SET slug = LEFT(slug, 50)
WHERE LENGTH(slug) > 50;

UPDATE tags
SET description = LEFT(description, 200)
WHERE description IS NOT NULL AND LENGTH(description) > 200;

UPDATE tags
SET color = LEFT(color, 7)
WHERE color IS NOT NULL AND LENGTH(color) > 7;

-- 2. 应用列类型约束
ALTER TABLE tags
  ALTER COLUMN name TYPE VARCHAR(50),
  ALTER COLUMN slug TYPE VARCHAR(50),
  ALTER COLUMN description TYPE VARCHAR(200),
  ALTER COLUMN color TYPE VARCHAR(7);

-- 3. 添加注释说明约束
COMMENT ON COLUMN tags.name IS '标签名称，最多50字符';
COMMENT ON COLUMN tags.slug IS 'URL友好标识符，最多50字符';
COMMENT ON COLUMN tags.description IS '标签描述，最多200字符';
COMMENT ON COLUMN tags.color IS '标签颜色，#RRGGBB格式（7字符）';

