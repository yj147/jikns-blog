# 分支保护配置指南

此文档说明如何在 GitHub 仓库中配置分支保护规则，强制执行代码质量检查。

## 配置步骤

### 1. 进入仓库设置

1. 打开 GitHub 仓库页面
2. 点击 `Settings` 选项卡
3. 在左侧边栏点击 `Branches`

### 2. 添加分支保护规则

1. 点击 `Add rule` 按钮
2. 在 `Branch name pattern` 中输入 `main`（或您的主分支名称）

### 3. 配置保护选项

#### 必选配置

- ✅ `Require a pull request before merging`
  - ✅ `Require approvals`: 至少 1 个审批
  - ✅ `Dismiss stale PR approvals when new commits are pushed`

- ✅ `Require status checks to pass before merging`
  - ✅ `Require branches to be up to date before merging`
  - 添加必需的状态检查：
    - `代码质量检查` (来自 quality-check.yml 工作流)

#### 推荐配置

- ✅ `Require conversation resolution before merging`
- ✅ `Include administrators` (确保管理员也遵守规则)
- ✅ `Allow force pushes`: ❌ 禁用
- ✅ `Allow deletions`: ❌ 禁用

### 4. 保存配置

点击 `Create` 按钮保存分支保护规则。

## 工作流程

配置完成后，开发工作流程如下：

1. **创建功能分支**: `git checkout -b feature/new-feature`
2. **本地开发**: 编写代码，pre-push hook 自动执行质量检查
3. **推送分支**: `git push origin feature/new-feature`
4. **创建 PR**: GitHub Actions 自动运行 quality-check 工作流
5. **通过检查**: 必须所有质量检查通过才能合并
6. **代码审查**: 至少需要 1 个团队成员审批
7. **合并到主分支**: 只有满足所有条件才能合并

## 质量检查内容

### 自动检查项目

- **ESLint**: 代码规范和最佳实践
- **TypeScript**: 类型安全检查
- **Prettier**: 代码格式一致性
- **关键测试**: 核心功能回归测试

### 质量标准

- ESLint: 零错误，警告数量 ≤ 1000
- TypeScript: 零类型错误
- Prettier: 100% 格式一致
- 测试: 关键测试 100% 通过

## 绕过保护（紧急情况）

如果遇到紧急情况需要绕过保护规则：

1. **临时禁用保护**: 仓库管理员可以临时修改保护规则
2. **管理员推送**: 如果启用了 "Include administrators"，需要先禁用此选项
3. **修复后恢复**: 紧急修复后立即恢复保护规则

## 故障排除

### 常见问题

#### 质量检查失败

```bash
# 在本地修复问题
pnpm lint --fix          # 自动修复代码规范问题
pnpm format              # 自动修复格式问题
pnpm type-check          # 检查类型错误
pnpm test:critical       # 运行关键测试
```

#### 分支不是最新的

```bash
# 更新分支到最新状态
git fetch origin main
git merge origin/main    # 或者使用 rebase
```

#### 状态检查未出现

1. 确认工作流文件路径正确: `.github/workflows/quality-check.yml`
2. 确认工作流语法正确
3. 检查仓库的 Actions 页面是否有错误

## 维护建议

1. **定期审查**: 每季度审查保护规则的有效性
2. **更新检查**: 随着项目发展调整质量标准
3. **团队培训**: 确保团队成员了解质量要求
4. **工具升级**: 保持质量检查工具的最新版本
