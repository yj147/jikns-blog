# Phase 10：标签系统模块文档

**模块状态**: ✅ 核心功能已上线（标签云 / 详情 / 筛选全部可用）
**优先级**: P2 - 推荐
**预估工作量**: 7-8 个工作日（59 小时）
**实际进度**: M1-M3 已完成（Server Actions + 管理端 + 用户端），M4-M5 持续推进

---

## 📚 文档索引

### 核心文档

1. **[标签系统设计文档.md](./标签系统设计文档.md)**
   - 模块概述和业务价值
   - 数据模型详细分析（Tag 和 PostTag）
   - API 设计（Server Actions 函数签名）
   - 组件架构（管理端 + 用户端）
   - 权限控制策略
   - 性能优化方案
   - 与现有模块的集成点

2. **[标签系统实施任务清单.md](./标签系统实施任务清单.md)**
   - 5 个里程碑的详细任务分解
   - 16 个具体任务的交付物和验收标准
   - 任务依赖关系和执行顺序
   - 风险管理和缓解措施
   - 质量检查清单
   - 上线准备和回滚预案

---

## 🎯 模块概述

### 业务价值
标签系统是内容组织和发现的核心功能，提供：
- **管理员**: 统一的标签治理能力，避免标签混乱和重复
- **用户**: 通过标签快速发现感兴趣的内容
- **平台**: 提升内容组织效率和用户体验

### 核心功能
1. **标签管理**（管理员）
   - 标签 CRUD 操作
   - 标签列表查看和搜索
   - 标签使用统计

2. **标签展示**（用户）
   - 标签云页面（所有标签）
   - 标签详情页（标签下的文章列表）
   - 按标签筛选文章

3. **增强功能**
   - 标签自动补全（文章编辑时）
   - 热门标签推荐
   - 标签搜索

---

## 🏗️ 技术架构

### 数据模型
```prisma
model Tag {
  id          String    @id @default(cuid())
  name        String    @unique
  slug        String    @unique
  description String?
  color       String?
  postsCount  Int       @default(0)  // 冗余计数字段
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  posts       PostTag[]
}

model PostTag {
  postId    String
  tagId     String
  createdAt DateTime @default(now())
  post      Post     @relation(onDelete: Cascade)
  tag       Tag      @relation(onDelete: Cascade)
  @@id([postId, tagId])
}
```

### 服务分层
- **Server Actions**: `lib/actions/tags/` - 标签 CRUD 和查询（模块化拆分）
  - `mutations.ts` - 创建、更新、删除操作
  - `queries.ts` - 列表、详情、搜索查询
  - `index.ts` - 统一导出接口
- **仓储层**: `lib/repos/tag-repo.ts` - 标签同步和计数（已存在）
- **UI 层**: 管理界面和用户界面组件
- **页面层**: Next.js App Router 页面

---

## 📋 实施计划

### 里程碑时间线

| 里程碑 | 日期 | 任务数 | 状态 |
| ------ | ---- | ------ | ---- |
| M0 方案冻结 | 10-09 | - | ✅ 已完成 |
| M1 Server Actions | 10-10 ~ 10-11 | 4 | ✅ 已完成 |
| M2 管理端界面 | 10-12 ~ 10-13 | 3 | ✅ 已完成 |
| M3 用户端界面 | 10-14 ~ 10-15 | 3 | ✅ 已完成 |
| M4 增强功能 | 10-16 ~ 10-17 | 3 | 📋 待开始 |
| M5 测试与文档 | 10-18 | 3 | 🚧 进行中 |

### 关键交付物

#### M1: Server Actions（4 个任务）✅
- `lib/actions/tags/mutations.ts` - 标签创建、更新、删除 API
- `lib/actions/tags/queries.ts` - 标签查询、搜索 API
- `tests/actions/tags.test.ts` - 单元测试（覆盖率 > 85%）

#### M2: 管理端界面（3 个任务）✅
- `app/admin/tags/page.tsx` - 标签管理列表页
- `components/admin/tag-dialog.tsx` - 标签编辑对话框
- `tests/components/admin/tag-dialog.test.tsx` - 组件单元测试

#### M3: 用户端界面（3 个任务）✅
- `app/tags/page.tsx` - 标签云页面（已上线，支持分页与搜索）
- `app/tags/[slug]/page.tsx` - 标签详情页（已上线，附带错误兜底）
- `components/blog/tag-filter.tsx` - 标签筛选组件（已上线，可直接筛选文章）

#### M4: 增强功能（3 个任务）
- `components/admin/tag-autocomplete.tsx` - 标签自动补全
- `components/blog/popular-tags.tsx` - 热门标签推荐
- 增强功能集成测试

#### M5: 测试与文档（3 个任务）
- `tests/e2e/tags.spec.ts` - E2E 测试
- 测试覆盖率提升（≥ 85%）
- 文档完善（使用指南、API 文档）

---

## ✅ Definition of Done

根据 `docs/0-foundations/系统模块设计顺序.md` Phase 10 的要求：

- [ ] 管理员发布文章时可以添加标签（已有，需增强为自动补全）
- [ ] 支持标签自动补全和建议
- [x] 标签云页面显示所有标签及文章数量
- [x] 用户可以按标签筛选文章
- [x] 标签页面显示相关文章列表
- [x] 热门标签推荐功能
- [ ] 所有管理操作通过 `ADMIN` 权限验证
- [ ] TypeScript 编译无错误
- [ ] 单元测试覆盖率 ≥ 85%
- [ ] 集成测试覆盖核心流程
- [ ] E2E 测试覆盖主要用户场景
- [ ] 文档完善（使用指南、API 文档）

---

## 🔗 依赖关系

### 前置依赖（已完成）
- ✅ Phase 2-4: 认证权限系统
- ✅ Phase 5: 博客文章管理系统
- ✅ `lib/repos/tag-repo.ts`: 标签同步和计数逻辑

### 后续模块
- Phase 11: 搜索功能（将利用标签进行内容检索）
- Phase 12: 归档功能（可能需要标签统计数据）

---

## 🎨 设计原则

### Linus 哲学
1. **好品味（Good Taste）**: 消除特殊情况，标签的 CRUD 就是标准的数据库操作
2. **Never break userspace**: 所有新功能都是增量添加，不修改现有代码
3. **实用主义**: 解决真实问题（标签管理混乱），不过度设计
4. **简洁执念**: 保持代码简洁清晰，函数短小精悍

### 技术约束
- 使用 Next.js App Router 和 Server Actions
- 遵循项目的 TypeScript 类型安全规范
- 使用 shadcn/ui 组件库构建界面
- 确保权限检查（管理员操作需验证 `role === 'ADMIN'`）
- 保持数据一致性（事务保护、计数同步）

---

## 📊 质量标准

### 性能指标
- 标签列表查询响应时间 < 500ms
- 标签详情页加载时间 < 1s
- 自动补全搜索响应时间 < 300ms
- 页面 Lighthouse 评分 ≥ 90

### 测试覆盖
- 单元测试覆盖率 ≥ 85%
- 分支覆盖率 ≥ 70%
- 集成测试覆盖核心流程
- E2E 测试覆盖主要用户场景

### 代码质量
- TypeScript 编译无错误
- ESLint 检查通过
- Prettier 格式化通过
- 代码复杂度合理（圈复杂度 < 10）

---

## 🚀 快速开始

### 阅读顺序
1. 先阅读 **[标签系统设计文档.md](./标签系统设计文档.md)** 了解整体架构
2. 再阅读 **[标签系统实施任务清单.md](./标签系统实施任务清单.md)** 了解具体任务
3. 按照任务清单的顺序开始实施

### 开发流程
1. 从 M1 开始，按顺序完成每个里程碑
2. 每个任务完成后运行 `pnpm quality:check` 确保代码质量
3. 每个里程碑完成后运行完整的测试套件
4. 所有任务完成后进行上线前检查

---

## 🧭 用户操作指南

### 标签云（`/tags`）
- 顶部搜索框支持模糊匹配，提交后直接跳转带 `q` 参数的同页查询。
- 分页采用 querystring（`?page=N`）管理，URL 可分享；空列表也会显示 `1/1`，避免“第 1/0 页”错觉。

### 标签筛选（`components/blog/tag-filter.tsx`）
- 默认展示 10 个热门标签，点击徽章即可切换 `tag` 查询参数；再次点击取消筛选。
- 速率限制触发时组件会告警“请等待 X 秒”，并提供“重试加载”按钮，防止用户误以为无可用标签。

### 标签详情（`/tags/[slug]`）
- 页面通过 `ClientPagination` 控制文章分页，失败会弹出“文章加载失败”卡片并提供重载/查看全部文章入口。
- 标签信息区同步展示文章总数与描述，便于快速验证标签治理效果。

---

## 📝 变更记录

| 版本 | 日期 | 变更内容 | 作者 |
| ---- | ---- | -------- | ---- |
| v1.0 | 2025-10-09 | 初始版本，完成设计文档和任务清单 | Linus 模式技术助手 |

---

## 📞 联系方式

如有问题或建议，请参考：
- 设计文档中的详细说明
- 任务清单中的验收标准
- `docs/0-foundations/系统模块设计顺序.md` 中的 Phase 10 定义

---

_本模块文档遵循项目既定的文档规范，与 Phase 9 关注系统的文档结构保持一致。_
