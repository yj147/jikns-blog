# Phase 3 权限系统测试套件

## 概述

本测试套件专为 Phase 3 权限系统实现而设计，提供全面的测试覆盖以确保认证和授权功能的安全性、可靠性和性能。

## 测试架构

### 测试分层策略

```
┌─────────────────────────────────────────────┐
│                  E2E 测试                   │  ← 用户完整流程
├─────────────────────────────────────────────┤
│                 集成测试                    │  ← 组件协作
├─────────────────────────────────────────────┤
│                 单元测试                    │  ← 函数逻辑
└─────────────────────────────────────────────┘
```

### 测试文件结构

```
tests/
├── integration/              # 集成测试
│   ├── middleware.test.ts       # 中间件权限控制
│   ├── api-permissions.test.ts  # API 端点权限
│   └── permissions.test.ts      # 权限验证函数
├── unit/                     # 单元测试
│   └── auth-components.test.tsx # 权限组件
├── helpers/                  # 测试工具
│   ├── test-data.ts            # 测试数据生成
│   └── test-coverage.ts        # 覆盖率配置
├── __mocks__/               # Mock 模块
│   ├── supabase.ts             # Supabase 客户端 Mock
│   └── prisma.ts               # Prisma 客户端 Mock
├── scripts/                 # 测试脚本
│   └── run-permission-tests.sh # 权限测试执行脚本
└── setup.ts                 # 测试环境配置
```

## 测试覆盖范围

### 🔐 权限控制测试

#### Middleware 权限控制
- ✅ 路径级权限验证 (`/admin`, `/api/admin`, `/profile`)
- ✅ 角色权限检查 (`USER` vs `ADMIN`)
- ✅ 用户状态验证 (`ACTIVE` vs `BANNED`)
- ✅ 重定向逻辑测试
- ✅ 权限缓存机制

#### API 端点权限
- ✅ `/api/user/*` 路由认证要求
- ✅ `/api/admin/*` 路由管理员权限
- ✅ Server Actions 权限保护
- ✅ 错误状态码标准化
- ✅ 并发请求处理

#### 权限验证函数
- ✅ `requireAuth()` 认证检查
- ✅ `requireAdmin()` 管理员验证
- ✅ `getCurrentUser()` 用户信息获取
- ✅ `getUserSession()` 会话管理
- ✅ `syncUserFromAuth()` 用户数据同步

### 🛡️ 安全测试

#### 输入验证与防护
- ✅ SQL 注入防护测试
- ✅ XSS 攻击防护验证
- ✅ CSRF 保护检查
- ✅ 恶意重定向防护
- ✅ 输入数据清理验证

#### 认证安全
- ✅ JWT 令牌安全验证
- ✅ 会话劫持防护
- ✅ 无效令牌处理
- ✅ 会话过期机制
- ✅ 跨域请求控制

### 🎨 UI 组件测试

#### 权限组件
- ✅ `<ProtectedRoute>` 路由守卫
- ✅ `<AdminOnly>` 管理员专用组件
- ✅ `<AuthRequired>` 认证要求组件
- ✅ 权限 Hook (`usePermissions`)
- ✅ 用户界面响应测试

#### 用户交互
- ✅ 登录状态切换
- ✅ 权限变更响应
- ✅ 加载状态处理
- ✅ 错误状态显示
- ✅ 重定向行为验证

### ⚡ 性能测试

#### 响应时间
- ✅ 权限检查 < 50ms
- ✅ API 响应 < 200ms
- ✅ 组件渲染 < 150ms
- ✅ 测试执行 < 2分钟

#### 缓存优化
- ✅ 权限信息缓存
- ✅ React cache 优化
- ✅ 重复查询避免
- ✅ 内存使用控制

## 测试场景矩阵

| 用户类型 | 路径类型 | 预期结果 | 测试覆盖 |
|----------|----------|----------|----------|
| 未登录 | 公开路径 | ✅ 允许访问 | ✅ |
| 未登录 | 需认证路径 | 🔄 重定向登录 | ✅ |
| 未登录 | 管理路径 | 🔄 重定向登录 | ✅ |
| 普通用户 | 公开路径 | ✅ 允许访问 | ✅ |
| 普通用户 | 需认证路径 | ✅ 允许访问 | ✅ |
| 普通用户 | 管理路径 | ❌ 拒绝访问 | ✅ |
| 管理员 | 所有路径 | ✅ 允许访问 | ✅ |
| 被封禁用户 | 任何需认证路径 | ❌ 拒绝访问 | ✅ |

## 测试数据

### 标准测试用户

```typescript
// 管理员用户
admin: {
  id: 'admin-test-id-001',
  email: 'admin@test.com',
  name: '测试管理员',
  role: 'ADMIN',
  status: 'ACTIVE'
}

// 普通用户  
user: {
  id: 'user-test-id-001',
  email: 'user@test.com', 
  name: '测试用户',
  role: 'USER',
  status: 'ACTIVE'
}

// 被封禁用户
bannedUser: {
  id: 'banned-test-id-001',
  email: 'banned@test.com',
  name: '被封禁用户', 
  role: 'USER',
  status: 'BANNED'
}
```

### 测试路径配置

```typescript
// 公开路径
public: ['/', '/blog', '/login', '/register']

// 认证路径  
authenticated: ['/profile', '/settings', '/api/user/*']

// 管理路径
admin: ['/admin', '/admin/*', '/api/admin/*']
```

## 执行测试

### 基本命令

```bash
# 执行所有权限测试
pnpm test:permissions

# 执行单元测试
pnpm test:permissions:unit

# 执行集成测试
pnpm test:permissions:integration

# 执行覆盖率测试
pnpm test:permissions:coverage

# 执行性能测试
pnpm test:permissions:performance

# 监听模式
pnpm test:permissions:watch
```

### 高级用法

```bash
# 使用测试脚本 (推荐)
./tests/scripts/run-permission-tests.sh

# 指定测试类型
./tests/scripts/run-permission-tests.sh coverage

# 查看帮助
./tests/scripts/run-permission-tests.sh --help
```

## 质量标准

### 覆盖率目标

| 测试类型 | 语句覆盖率 | 分支覆盖率 | 函数覆盖率 | 行覆盖率 |
|----------|------------|------------|------------|----------|
| 核心权限逻辑 | ≥ 90% | ≥ 85% | ≥ 90% | ≥ 90% |
| API 权限控制 | ≥ 85% | ≥ 80% | ≥ 85% | ≥ 85% |
| UI 权限组件 | ≥ 80% | ≥ 75% | ≥ 80% | ≥ 80% |

### 性能指标

| 指标类型 | 目标值 | 当前状态 |
|----------|--------|----------|
| 权限检查时间 | < 50ms | 🎯 目标 |
| API 响应时间 | < 200ms | 🎯 目标 |
| 测试执行时间 | < 2分钟 | 🎯 目标 |
| 内存使用 | < 1MB/小时增长 | 🎯 目标 |

### 安全验证

- ✅ **认证绕过防护**: 防止未认证访问
- ✅ **权限提升防护**: 防止权限越级
- ✅ **会话劫持防护**: 安全会话管理
- ✅ **输入注入防护**: SQL/XSS/CSRF 保护
- ✅ **重定向攻击防护**: 安全重定向验证

## 持续集成

### CI/CD 集成

```yaml
# GitHub Actions 示例
- name: 运行权限系统测试
  run: |
    pnpm test:permissions:coverage
    
- name: 检查测试覆盖率
  run: |
    pnpm test:ci
    
- name: 上传覆盖率报告
  uses: codecov/codecov-action@v1
  with:
    file: ./coverage/permissions/lcov.info
```

### 质量门禁

测试必须满足以下条件才能通过：

1. **零失败测试**: 所有测试用例必须通过
2. **覆盖率达标**: 核心逻辑覆盖率 ≥ 85%
3. **性能合格**: 测试执行时间 < 2分钟
4. **安全验证**: 所有安全测试通过
5. **类型检查**: TypeScript 编译无错误

## 故障排查

### 常见问题

#### 测试环境问题

```bash
# 问题: 测试无法找到 Supabase 环境变量
# 解决: 确保环境变量正确设置
export NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="test-anon-key"
```

#### Mock 问题

```bash
# 问题: Prisma/Supabase Mock 不生效
# 解决: 检查 vi.mock 路径是否正确
vi.mock('@/lib/supabase', () => mockSupabaseModule)
```

#### 覆盖率问题

```bash
# 问题: 覆盖率统计不准确
# 解决: 清理缓存重新运行
pnpm vitest run --coverage --clean
```

### 调试技巧

1. **使用 `--reporter=verbose` 获取详细输出**
2. **通过 `console.log` 调试 Mock 状态**
3. **使用 `--bail` 在第一个失败时停止**
4. **检查 `coverage/permissions/` 目录的报告**

## 未来扩展

### Phase 4 安全优化测试

- 🔄 **CSRF 令牌验证测试**
- 🔄 **XSS 过滤机制测试**
- 🔄 **会话安全强化测试**
- 🔄 **错误处理优化测试**

### Phase 5 部署测试

- 🔄 **生产环境兼容性测试**
- 🔄 **负载测试和压力测试**
- 🔄 **监控和告警测试**
- 🔄 **回滚机制测试**

---

## 总结

这个测试套件为 Phase 3 权限系统提供了全面的测试覆盖，确保：

- **🔐 安全性**: 全方位的权限控制和安全防护
- **🎯 可靠性**: 高覆盖率和严格的质量标准
- **⚡ 性能**: 优化的执行速度和资源使用
- **🔧 可维护性**: 清晰的结构和完善的文档

通过严格执行这些测试，我们可以确信权限系统在生产环境中的安全性和稳定性。