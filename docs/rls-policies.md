# users 表 RLS 策略变更说明（2025-11-25）

## 变更要点
- 新建策略：
  - `users_select_public_whitelist`（TO anon）：只读白名单列 `id/name/avatarUrl/bio/createdAt`。
  - `users_select_self_or_admin`（TO authenticated）：自身或管理员可读完整记录，管理员判定通过 `public.is_admin_user()`。
  - `users_select_service_role`：保持 service_role 完量访问（Prisma 依赖）。
- 列权限改为白名单：仅 anon 拥有上述 5 个列的 SELECT 权限，authenticated 仍保留全列访问。
- 新增 `public.is_admin_user(text)` 安全函数（SECURITY DEFINER），避免策略自引用递归。
- 启用并强制 RLS：`ALTER TABLE public.users ENABLE/FORCE ROW LEVEL SECURITY;`

## 应用步骤
1) 确认本地 Supabase 已启动（`pnpm supabase:start`）。  
2) 应用迁移  
   ```bash
   supabase db reset   # 会重新应用 supabase/migrations 下所有 SQL
   # 或手动：
   psql "$TEST_DATABASE_URL" -f supabase/migrations/20251125120000_tighten_users_rls_whitelist.sql
   ```
3) 手动验证（PostgREST）  
   - 匿名：`curl -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/users?select=*"`  
     返回字段仅应包含 `id,name,avatarUrl,bio,createdAt`。  
   - 登录用户：携带用户 JWT，`select=email,phone` 仅返回本人记录。  
   - 管理员：携带管理员 JWT，可读取所有用户完整字段。

## 回滚
- 直接执行迁移中提供的回滚函数：  
  ```sql
  SELECT public.rollback_20251125120000_tighten_users_rls();
  ```
- 如需重新开放：再运行旧策略或 `supabase db reset` 到指定快照。

## 注意事项
- 由于列权限改为白名单，匿名或携带 anon JWT 的请求访问敏感列将返回 403/permission denied。  
- Prisma/service_role 不受 RLS 影响（仍有 GRANT ALL）。  
- 登录用户若需读取其他用户的公开字段，请使用 anon key 或服务端聚合接口。
