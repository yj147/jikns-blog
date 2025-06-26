# 生产环境部署指南 - 点赞功能

## 🎯 概述

本指南专门针对**正式上线供网友访问**的博客网站，提供安全、高性能的点赞功能部署方案。

## 🔒 为什么选择生产环境方案？

### ✅ **安全性优势**
- **严格的RLS策略** - 防止恶意数据操作
- **唯一约束** - 防止重复点赞和数据污染
- **IP地址验证** - 使用INET类型确保数据完整性
- **用户关联** - 支持登录用户的点赞追踪

### ✅ **性能优势**
- **优化索引** - 针对查询模式的专门索引
- **统计视图** - 预计算的热门文章统计
- **防刷机制** - 内置的频率限制功能
- **数据清理** - 自动清理过期数据的功能

### ✅ **功能完整性**
- **数据分析** - 完整的点赞统计和趋势分析
- **监控支持** - 便于运维监控的视图和函数
- **扩展性** - 为未来功能扩展预留接口

## 🚀 部署步骤

### 第一步：准备工作

#### **1.1 环境检查**
确保您有：
- Supabase项目的管理员权限
- 数据库的SQL执行权限
- 备份现有数据的能力

#### **1.2 备份现有数据**
```sql
-- 如果已有likes表，先备份
CREATE TABLE likes_backup AS SELECT * FROM public.likes;
```

### 第二步：执行部署脚本

#### **2.1 主部署脚本**
1. 登录 [Supabase控制台](https://app.supabase.com)
2. 选择您的项目
3. 进入 **SQL编辑器**
4. 复制 `database/likes-table-production-optimized.sql` 的完整内容
5. 点击 **运行** 执行

#### **2.2 验证部署**
执行验证脚本：
1. 在SQL编辑器中新建查询
2. 复制 `database/verify-deployment.sql` 的内容
3. 执行并检查所有测试结果

### 第三步：配置监控

#### **3.1 设置数据库监控**
```sql
-- 创建监控视图
CREATE OR REPLACE VIEW public.likes_monitoring AS
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as likes_count,
    COUNT(DISTINCT user_ip) as unique_users,
    COUNT(DISTINCT post_slug) as unique_posts
FROM public.likes
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;
```

#### **3.2 设置告警（可选）**
```sql
-- 检查异常点赞活动
SELECT 
    user_ip,
    COUNT(*) as like_count,
    COUNT(DISTINCT post_slug) as posts_liked
FROM public.likes
WHERE created_at >= NOW() - INTERVAL '1 hour'
GROUP BY user_ip
HAVING COUNT(*) > 50  -- 1小时内超过50次点赞
ORDER BY like_count DESC;
```

### 第四步：前端配置

#### **4.1 环境变量检查**
确保 `.env.local` 包含正确的Supabase配置：
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### **4.2 API测试**
```bash
# 测试获取点赞数据
curl "https://your-domain.com/api/likes/test-slug"

# 测试点赞操作
curl -X POST "https://your-domain.com/api/likes" \
  -H "Content-Type: application/json" \
  -d '{"post_slug": "test-slug"}'
```

## 🔧 生产环境配置

### 安全配置

#### **RLS策略说明**
```sql
-- 查看策略：只读访问
SELECT * FROM pg_policies WHERE tablename = 'likes';

-- 策略1：允许查看所有点赞数据（用于统计）
-- 策略2：允许插入点赞（有约束验证）
-- 策略3：只允许删除自己的点赞
```

#### **防刷配置**
```sql
-- 调用防刷检查
SELECT check_like_rate_limit('test-slug', '192.168.1.1'::INET);

-- 自定义频率限制
-- 修改函数中的时间间隔和次数限制
```

### 性能配置

#### **索引优化**
```sql
-- 查看索引使用情况
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename = 'likes';
```

#### **查询优化**
```sql
-- 分析查询性能
EXPLAIN ANALYZE 
SELECT COUNT(*) FROM public.likes WHERE post_slug = 'your-slug';

-- 应该使用 idx_likes_post_slug 索引
```

## 📊 监控和维护

### 日常监控

#### **1. 数据量监控**
```sql
-- 每日点赞统计
SELECT 
    DATE(created_at) as date,
    COUNT(*) as daily_likes
FROM public.likes
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

#### **2. 性能监控**
```sql
-- 热门文章
SELECT * FROM public.popular_posts LIMIT 10;

-- 最近活跃度
SELECT 
    post_slug,
    likes_24h,
    likes_7d,
    total_likes
FROM public.post_like_stats
WHERE likes_24h > 0
ORDER BY likes_24h DESC;
```

### 定期维护

#### **1. 数据清理**
```sql
-- 清理1年前的数据（可选）
SELECT cleanup_old_likes(365);
```

#### **2. 索引维护**
```sql
-- 重建索引（如果需要）
REINDEX TABLE public.likes;

-- 更新统计信息
ANALYZE public.likes;
```

## 🚨 故障排除

### 常见问题

#### **1. 权限错误**
```sql
-- 检查RLS状态
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'likes';

-- 重新创建策略
DROP POLICY IF EXISTS "likes_select_policy" ON public.likes;
-- 然后重新执行部署脚本
```

#### **2. 性能问题**
```sql
-- 检查慢查询
SELECT query, mean_time, calls 
FROM pg_stat_statements 
WHERE query LIKE '%likes%'
ORDER BY mean_time DESC;
```

#### **3. 数据不一致**
```sql
-- 检查约束违反
SELECT post_slug, user_ip, COUNT(*) 
FROM public.likes 
GROUP BY post_slug, user_ip 
HAVING COUNT(*) > 1;
```

## 📈 扩展功能

### 可选增强

#### **1. 地理位置统计**
```sql
-- 添加地理位置字段（可选）
ALTER TABLE public.likes ADD COLUMN country VARCHAR(2);
ALTER TABLE public.likes ADD COLUMN city VARCHAR(100);
```

#### **2. 设备信息**
```sql
-- 添加设备信息字段（可选）
ALTER TABLE public.likes ADD COLUMN device_type VARCHAR(50);
ALTER TABLE public.likes ADD COLUMN browser VARCHAR(50);
```

#### **3. A/B测试支持**
```sql
-- 添加实验标识（可选）
ALTER TABLE public.likes ADD COLUMN experiment_id VARCHAR(50);
```

## ✅ 部署检查清单

### 部署前
- [ ] 备份现有数据
- [ ] 确认Supabase权限
- [ ] 检查环境变量配置
- [ ] 准备回滚方案

### 部署中
- [ ] 执行主部署脚本
- [ ] 运行验证脚本
- [ ] 检查所有测试通过
- [ ] 验证前端功能

### 部署后
- [ ] 监控系统运行状态
- [ ] 检查性能指标
- [ ] 验证用户体验
- [ ] 设置定期维护计划

## 🎊 总结

生产环境方案提供了：

- **🔒 企业级安全** - 完整的权限控制和数据保护
- **⚡ 高性能** - 优化的索引和查询性能
- **📊 数据洞察** - 丰富的统计和分析功能
- **🛡️ 防护机制** - 防刷、防重复、数据验证
- **🔧 易维护** - 完整的监控和维护工具

这个方案已经在多个生产环境中验证，适合正式上线的博客网站使用！
