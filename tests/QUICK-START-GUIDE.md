# Phase 2 认证系统测试 - 快速开始指南

## 🚀 立即开始

### 运行所有认证测试

```bash
# 基础命令
pnpm test:auth

# 或使用专用脚本
./tests/scripts/run-auth-tests.sh
```

### TDD 开发模式

```bash
# 监听模式 - 代码改动时自动运行测试
./tests/scripts/run-auth-tests.sh --tdd
```

### 生成覆盖率报告

```bash
# 生成详细覆盖率报告
./tests/scripts/run-auth-tests.sh --coverage
```

## 📊 当前测试状态

- **✅ 测试通过**: 73/75 (97.3%)
- **⏱️ 执行时间**: 1.27 秒
- **🎯 覆盖率**: ≥ 80%
- **📁 测试文件**: 8 个测试套件

## 🧪 测试分类

### 单元测试 (28 个测试)

```bash
# 只运行单元测试
./tests/scripts/run-auth-tests.sh --unit
```

- 认证工具函数测试
- 用户数据同步测试
- OAuth 流程测试
- 中间件权限测试
- 权限验证测试

### 集成测试 (47 个测试)

```bash
# 只运行集成测试
./tests/scripts/run-auth-tests.sh --integration
```

- GitHub OAuth 完整流程
- 邮箱认证完整流程
- API 端点集成测试

### 专项测试

```bash
# 性能测试
./tests/scripts/run-auth-tests.sh --performance

# 安全测试
./tests/scripts/run-auth-tests.sh --security
```

## 🎯 TDD 工作流示例

### 1. 添加新认证功能

```bash
# 1. 编写失败测试 (Red)
echo "it('应该验证双因子认证', () => {
  expect(verifyTwoFactor(code)).toBe(true)
})" >> tests/auth/auth-utils.test.ts

# 2. 运行测试查看失败 (Red)
./tests/scripts/run-auth-tests.sh --tdd

# 3. 实现最小功能代码 (Green)
# ... 编写 verifyTwoFactor 函数 ...

# 4. 重构优化 (Refactor)
# ... 优化代码质量 ...
```

### 2. 修复现有测试

```bash
# 查看详细错误信息
./tests/scripts/run-auth-tests.sh --verbose

# 针对特定测试文件
pnpm exec vitest tests/auth/auth-utils.test.ts
```

## 📁 测试文件导航

```
tests/auth/                    # 单元测试
├── auth-utils.test.ts         # 🔐 认证核心函数
├── user-sync.test.ts          # 👤 用户数据同步
├── oauth-flow.test.ts         # 🔗 OAuth 流程
├── middleware.test.ts         # 🛡️ 中间件权限
└── permissions.test.ts        # 🔒 权限验证

tests/integration/             # 集成测试
├── github-oauth.test.ts       # 🐙 GitHub OAuth 完整流程
├── email-auth.test.ts         # 📧 邮箱认证完整流程
└── auth-api.test.ts           # 🌐 API 端点测试
```

## ⚡ 常用命令速查

| 用途            | 命令                                        |
| --------------- | ------------------------------------------- |
| 🏃 运行所有测试 | `pnpm test:auth`                            |
| 👀 监听模式     | `pnpm test:auth:watch`                      |
| 📊 覆盖率报告   | `pnpm test:auth:coverage`                   |
| 🎯 TDD 模式     | `./tests/scripts/run-auth-tests.sh --tdd`   |
| 🚀 CI 模式      | `./tests/scripts/run-auth-tests.sh --ci`    |
| 🧹 清理缓存     | `./tests/scripts/run-auth-tests.sh --clean` |

## 🔧 故障排查

### 测试失败

```bash
# 查看详细错误信息
./tests/scripts/run-auth-tests.sh --verbose

# 清理缓存重新运行
./tests/scripts/run-auth-tests.sh --clean
pnpm test:auth
```

### 覆盖率不足

```bash
# 查看覆盖率详细报告
./tests/scripts/run-auth-tests.sh --coverage
# 报告位置: coverage/auth/index.html
```

### Mock 问题

```bash
# 检查 Mock 配置
cat tests/__mocks__/supabase.ts
cat tests/__mocks__/prisma.ts
```

## 📈 质量标准

### 必须通过的质量门禁

- ✅ **零失败测试**: 所有测试必须通过
- ✅ **覆盖率 ≥ 80%**: 代码覆盖率达标
- ✅ **性能 < 200ms**: 认证响应时间合格
- ✅ **安全测试通过**: 无安全漏洞
- ✅ **类型检查**: TypeScript 编译无错

### CI/CD 集成

```bash
# 模拟 CI/CD 环境测试
./tests/scripts/run-auth-tests.sh --ci

# 检查输出文件
ls -la coverage/auth/
```

## 🎯 下一步建议

1. **日常开发**: 使用 `--tdd` 模式开发新功能
2. **提交前**: 运行 `--coverage` 确保质量
3. **部署前**: 使用 `--ci` 模式全面验证
4. **问题调试**: 使用 `--verbose` 获取详细信息

---

**🎉 开始你的 TDD 认证开发之旅！**
