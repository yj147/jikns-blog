# Phase 2 认证系统集成测试套件

本测试套件专为 **Phase 2 核心认证功能** 设计，提供全面的集成测试覆盖，确保认证系统的可靠性和安全性。

## 📋 测试覆盖范围

### 🔐 核心认证流程
- **GitHub OAuth 认证** - 完整的OAuth流程，包括重定向、回调处理、用户数据同步
- **邮箱密码认证** - 注册、登录、密码重置等完整流程
- **会话管理** - 会话创建、刷新、过期处理
- **用户数据同步** - 首次登录创建、已有用户更新、数据一致性检查

### 🛡️ 安全性验证
- **认证状态验证** - Server Components 和 Server Actions 中的会话获取
- **权限检查** - 用户角色验证、状态检查（不包含 Phase 3 的 middleware）
- **错误处理** - 认证失败、网络错误、服务不可用等场景
- **配置安全** - 环境变量验证、配置错误处理

### 🔄 边界情况和异常处理
- **并发操作** - 并发登录、数据同步竞争条件
- **数据冲突** - 邮箱冲突、用户ID冲突处理
- **网络异常** - 连接失败恢复、重试机制
- **配置错误** - 环境变量缺失、无效配置处理

## 🗂️ 测试文件结构

```
tests/
├── integration/
│   ├── auth-flow.test.ts              # 完整认证流程集成测试
│   ├── session-management.test.ts     # 会话状态管理测试  
│   ├── user-sync.test.ts              # 用户数据同步测试
│   └── config-error-handling.test.ts  # 配置错误处理测试
├── config/
│   ├── test-database.ts               # 测试数据库配置
│   └── test-supabase.ts               # Supabase 模拟配置
├── helpers/
│   └── auth-test-helpers.ts           # 认证测试辅助工具
└── setup.ts                          # 全局测试设置
```

## 🚀 运行测试

### 快速开始

```bash
# 安装依赖
pnpm install

# 运行所有认证测试
pnpm test:auth

# 监听模式运行认证测试
pnpm test:auth:watch

# 生成覆盖率报告
pnpm test:auth:coverage

# TDD 模式（带自动重启）
pnpm test:auth:tdd
```

### 测试命令详解

| 命令 | 说明 | 适用场景 |
|------|------|----------|
| `pnpm test` | 运行所有测试 | CI/CD 环境 |
| `pnpm test:auth` | 只运行认证相关测试 | 认证功能开发 |
| `pnpm test:auth:watch` | 监听模式，文件变化自动重运行 | 开发调试 |
| `pnpm test:auth:coverage` | 生成详细覆盖率报告 | 质量验证 |
| `pnpm test:ci` | CI 模式（JSON + 文本报告） | 持续集成 |

### 单独运行特定测试文件

```bash
# 运行 GitHub OAuth 测试
vitest run tests/integration/auth-flow.test.ts

# 运行会话管理测试
vitest run tests/integration/session-management.test.ts

# 运行用户同步测试
vitest run tests/integration/user-sync.test.ts

# 运行配置错误处理测试
vitest run tests/integration/config-error-handling.test.ts
```

## 📊 测试覆盖率目标

### 总体目标
- **集成测试覆盖率**: ≥ 80%
- **关键认证路径**: 100%
- **错误处理分支**: ≥ 90%
- **边界情况**: ≥ 85%

### 各模块覆盖率目标

| 模块 | 目标覆盖率 | 重点关注 |
|------|------------|----------|
| GitHub OAuth 流程 | ≥ 95% | 完整流程、错误场景 |
| 邮箱密码认证 | ≥ 90% | 注册登录、密码管理 |
| 会话管理 | ≥ 85% | 生命周期、刷新机制 |
| 用户数据同步 | ≥ 90% | 创建更新、冲突处理 |
| 配置错误处理 | ≥ 80% | 环境变量、错误恢复 |

## 🔧 测试配置

### 环境变量设置

测试需要以下环境变量（在 `.env.local` 中配置）：

```env
# 测试数据库
DATABASE_URL="postgresql://test:test@localhost:5432/blog_test"
DATABASE_URL_TEST="postgresql://test:test@localhost:5432/blog_test"

# 本地 Supabase 实例
NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321"
NEXT_PUBLIC_SUPABASE_ANON_KEY="test-anon-key"

# 可选：GitHub OAuth（用于完整集成测试）
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
```

### 数据库设置

测试使用独立的测试数据库，每次测试前自动清理：

```bash
# 启动本地 Supabase 实例
supabase start

# 推送数据库架构
npx prisma db push

# 验证数据库连接
npx prisma db seed  # 可选
```

### Vitest 配置要点

测试配置位于 `vitest.config.ts`：

```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",           # 支持 DOM 操作
    setupFiles: "./tests/setup.ts", # 全局设置
    globals: true,                  # 全局测试函数
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./") }
  }
})
```

## 🎯 测试策略

### 1. 集成测试优先
- 测试完整的用户流程，而不是孤立的单元
- 验证 Supabase Auth 与应用数据库的集成
- 确保认证状态在整个应用中的一致性

### 2. 真实场景模拟
- 使用真实的数据结构和错误响应
- 模拟网络延迟和间歇性失败
- 测试并发操作和竞争条件

### 3. 边界情况覆盖
- 测试所有可能的错误路径
- 验证输入验证和数据清理
- 确保异常情况的优雅降级

### 4. 安全性验证
- 验证认证绕过尝试被阻止
- 测试会话劫持防护
- 确保敏感数据不泄露

## 📝 编写新测试

### 测试文件命名规范

```
tests/integration/{feature}-{type}.test.ts
```

例如：
- `auth-flow.test.ts` - 认证流程测试
- `session-management.test.ts` - 会话管理测试
- `user-permissions.test.ts` - 用户权限测试（Phase 3）

### 测试结构模板

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { cleanTestDatabase } from '../config/test-database'
import { resetSupabaseMocks } from '../config/test-supabase'

describe('功能名称测试', () => {
  beforeEach(async () => {
    await cleanTestDatabase()    // 清理数据库
    resetSupabaseMocks()        // 重置模拟
  })

  afterEach(() => {
    vi.clearAllMocks()          // 清理模拟状态
  })

  describe('具体场景', () => {
    it('应该正确处理某种情况', async () => {
      // Arrange: 准备测试数据
      
      // Act: 执行被测试的操作
      
      // Assert: 验证结果
    })
  })
})
```

### 最佳实践

1. **明确的测试描述**：使用中文描述测试意图
2. **AAA 模式**：Arrange-Act-Assert 结构
3. **独立性**：每个测试都能独立运行
4. **确定性**：避免随机性，确保结果可重复
5. **完整性**：测试正常流程和异常情况

## 🐛 故障排除

### 常见问题

#### 1. 数据库连接失败
```bash
Error: P1001: Can't reach database server
```

**解决方案**：
- 确认 PostgreSQL 服务正在运行
- 检查 `DATABASE_URL` 配置是否正确
- 验证数据库凭据和网络连接

#### 2. Supabase 连接错误
```bash
Error: Invalid Supabase URL or key
```

**解决方案**：
- 确认本地 Supabase 实例已启动
- 检查 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- 验证端口配置（默认 54321）

#### 3. 测试超时
```bash
Error: Test timed out in 5000ms
```

**解决方案**：
- 增加测试超时时间：`vi.setConfig({ testTimeout: 10000 })`
- 检查是否有死锁或无限循环
- 优化数据库查询性能

#### 4. 模拟状态污染
```bash
Error: Expected mock function to be called with...
```

**解决方案**：
- 确认 `beforeEach` 中调用 `resetSupabaseMocks()`
- 检查 `afterEach` 中的 `vi.clearAllMocks()`
- 避免跨测试共享模拟状态

### 调试技巧

1. **启用详细日志**：
```bash
VITEST_QUIET=false pnpm test:auth
```

2. **单独运行失败的测试**：
```bash
vitest run --reporter=verbose tests/integration/specific-test.test.ts
```

3. **查看覆盖率详情**：
```bash
pnpm test:auth:coverage
# 然后打开 coverage/index.html
```

## 📈 持续改进

### 定期评估
- 每周检查测试覆盖率报告
- 识别测试盲点和薄弱环节
- 根据新功能更新测试策略

### 性能监控
- 监控测试执行时间
- 优化慢速测试
- 考虑并行化测试执行

### 质量标准
- 保持测试套件的快速执行（< 30秒）
- 确保测试的稳定性（成功率 > 95%）
- 及时修复不稳定的测试

---

## 🤝 贡献指南

### 添加新测试

1. 在相应的集成测试文件中添加测试用例
2. 确保测试遵循现有的命名和结构规范
3. 添加必要的中文注释说明测试目的
4. 验证测试可以独立运行且结果可重复

### 报告问题

发现测试相关问题时，请提供：
- 详细的错误信息
- 复现步骤
- 环境配置信息
- 相关的日志输出

### 优化建议

欢迎提出以下方面的改进建议：
- 测试性能优化
- 覆盖率提升方案
- 新的测试场景
- 工具和流程改进

---

**注意**: 本测试套件专注于 Phase 2 的核心认证功能。Phase 3 的权限中间件和高级功能将在后续版本中添加相应测试。