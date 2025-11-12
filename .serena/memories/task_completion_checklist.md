# 任务完成检查清单

每个开发任务完成后必须执行的检查和验证步骤。

## 基础质量检查 (每个任务必须)

### 1. 代码质量验证

```bash
pnpm quality:check
```

这个命令包含：

- ESLint 代码检查
- TypeScript 类型检查
- Prettier 格式检查
- 关键测试运行

### 2. 测试验证

根据修改的内容运行相应测试：

```bash
# 基础测试
pnpm test:critical      # 关键核心测试

# 专项测试 (根据修改内容选择)
pnpm test:auth          # 认证相关修改
pnpm test:permissions   # 权限相关修改
pnpm test:security      # 安全相关修改
pnpm test:coverage      # 覆盖率检查
```

## 数据库相关任务额外检查

### 3. 数据库变更验证

如果修改了数据库 schema：

```bash
# 1. 确保 Prisma 客户端更新
pnpm db:generate

# 2. 验证本地数据库同步
pnpm db:push

# 3. 创建迁移文件 (如需版本控制)
supabase db diff -f "migration_description"

# 4. 验证种子数据 (如果有)
pnpm db:seed
```

## 组件/UI 相关任务额外检查

### 4. UI 组件验证

如果修改了组件：

```bash
# 运行组件测试
pnpm test components/

# 检查可访问性 (如果配置了)
pnpm test:a11y

# E2E 测试 (重要功能)
pnpm test:e2e
```

## 安全相关任务额外检查

### 5. 安全验证

如果涉及认证、权限或安全功能：

```bash
# 安全审计
pnpm security:check

# 权限测试
pnpm test:permissions

# 安全边界测试
pnpm test:security
```

## API/后端相关任务额外检查

### 6. API 验证

如果修改了 API 路由：

```bash
# API 集成测试
pnpm test integration/

# 验证 API 权限检查
pnpm test:permissions:integration
```

## Git 提交前检查

### 7. 提交前验证

```bash
# 检查 Git 状态
git status

# 检查修改内容
git diff

# 确保在正确分支
git branch
```

### 8. 提交信息规范

使用规范的提交信息格式：

```
类型(范围): 简短描述

详细描述 (可选)
```

## 环境特定检查

### 9. 本地环境验证

```bash
# 确保本地服务正常运行
supabase status

# 检查开发服务器
pnpm dev
# 浏览器访问 http://localhost:3999 验证功能
```

### 10. 构建验证 (重要功能)

对于重要功能或准备部署前：

```bash
# 生产构建测试
pnpm build

# 构建产物检查
pnpm start
```

## 文档更新检查

### 11. 文档同步

如果修改了重要功能：

- 更新相关的 README.md 部分
- 更新 API 文档 (如果有)
- 更新组件文档 (如果有)
- 考虑更新项目架构文档

## 错误处理检查

### 12. 错误场景验证

- 测试错误边界情况
- 验证用户输入验证
- 检查网络错误处理
- 确认用户友好的错误信息

## 性能检查 (可选，大型功能)

### 13. 性能验证

对于影响性能的修改：

```bash
# 运行性能测试 (如果配置了)
pnpm test:performance

# 检查包大小
pnpm build && du -sh .next/
```

## 最终确认清单

### ✅ 任务完成确认

- [ ] 功能按预期工作
- [ ] 所有测试通过
- [ ] 代码质量检查通过
- [ ] 无 TypeScript 错误
- [ ] 无 ESLint 错误
- [ ] 格式符合 Prettier 规范
- [ ] 数据库变更 (如有) 已正确处理
- [ ] 安全检查通过 (如适用)
- [ ] 文档已更新 (如需要)
- [ ] Git 提交信息规范
- [ ] 在正确的分支上开发

## 自动化检查

项目配置了以下自动化检查：

- **pre-commit hook**: 自动运行 lint 和 format
- **pre-push hook**: 运行质量检查
- **CI/CD** (如果配置): 自动运行完整测试套件

依赖这些自动化工具，但不完全依赖，手动检查仍然重要。
