# T3: 前端搜索 UI 实现任务

## 背景

T1 和 T2 已完成：数据库 FTS 索引就绪，API 端点 /api/search 已实现。

## 任务清单

### 1. 导航栏搜索框 (components/navigation-search.tsx)

创建全局搜索组件：

- 输入框（带搜索图标）
- Enter 键触发搜索，跳转到 /search?q=xxx
- 支持清空按钮
- 移动端响应式设计

### 2. 搜索结果页 (app/search/page.tsx)

创建搜索结果页面：

- 从 URL 参数读取 q 查询词
- 调用 /api/search 接口
- Tab 切换：全部/文章/动态/用户/标签
- 分页支持（limit/offset）
- Loading 骨架屏
- Empty 空状态提示
- Error 错误提示

### 3. 搜索结果卡片 (components/search/search-result-card.tsx)

不同类型的结果卡片：

- Post: 标题 + 摘要 + 发布时间
- Activity: 内容 + 作者 + 时间
- User: 头像 + 名称 + Bio
- Tag: 名称 + 描述 + 使用次数

### 4. 集成到导航栏

修改 components/navigation-server.tsx：

- 添加 NavigationSearch 组件

### 5. 测试文件 (tests/ui/search-page.test.tsx)

测试覆盖率 90% 以上：

- 搜索框输入和提交
- Tab 切换功能
- 结果渲染
- Loading/Empty/Error 状态

## 技术约束

- 使用 Next.js 15 App Router
- 使用 SWR 或 fetch 调用 API
- 使用 Tailwind CSS + shadcn/ui 组件
- 响应式设计（移动端优先）
- 遵循项目现有 UI 模式

## 参考文件

- app/api/search/route.ts - API 接口
- types/search.ts - 类型定义
- components/navigation-server.tsx - 导航栏
- app/blog/[slug]/page.tsx - 页面布局参考
