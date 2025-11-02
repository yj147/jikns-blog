# 现代化博客项目数据库实体关系图

## 完整 ERD 图

```mermaid
erDiagram
    %% 枚举定义
    Role ||--o{ User : has
    UserStatus ||--o{ User : has

    %% 用户系统
    User {
        string id PK
        string email UK
        string name
        string avatarUrl
        text bio
        json socialLinks
        Role role
        UserStatus status
        string passwordHash
        datetime createdAt
        datetime updatedAt
        datetime lastLoginAt
    }

    %% 博客模块
    Post {
        string id PK
        string slug UK
        string title
        text content
        string excerpt
        boolean published
        boolean isPinned
        string canonicalUrl
        string seoTitle
        string seoDescription
        int viewCount
        datetime createdAt
        datetime updatedAt
        datetime publishedAt
        string authorId FK
        string seriesId FK
    }

    Series {
        string id PK
        string title
        string slug UK
        text description
        string coverUrl
        int sortOrder
        datetime createdAt
        datetime updatedAt
        string authorId FK
    }

    Tag {
        string id PK
        string name UK
        string slug UK
        string description
        string color
        int postsCount
        datetime createdAt
        datetime updatedAt
    }

    PostTag {
        string postId PK,FK
        string tagId PK,FK
        datetime createdAt
    }

    %% 社交动态模块
    Activity {
        string id PK
        text content
        json imageUrls
        boolean isPinned
        datetime createdAt
        datetime updatedAt
        string authorId FK
    }

    %% 通用交互模块
    Comment {
        string id PK
        text content
        datetime createdAt
        datetime updatedAt
        string authorId FK
        string postId FK
        string activityId FK
        string parentId FK
    }

    Like {
        string id PK
        datetime createdAt
        string authorId FK
        string postId FK
        string activityId FK
    }

    %% 用户功能模块
    Bookmark {
        string id PK
        datetime createdAt
        string userId FK
        string postId FK
    }

    Follow {
        string followerId PK,FK
        string followingId PK,FK
        datetime createdAt
    }

    %% 关系定义
    %% 一对多关系
    User ||--o{ Post : "authors"
    User ||--o{ Series : "creates"
    User ||--o{ Activity : "publishes"
    User ||--o{ Comment : "writes"
    User ||--o{ Like : "gives"
    User ||--o{ Bookmark : "saves"

    Series ||--o{ Post : "contains"
    Post ||--o{ Comment : "receives"
    Activity ||--o{ Comment : "receives"
    Post ||--o{ Like : "receives"
    Activity ||--o{ Like : "receives"
    Post ||--o{ Bookmark : "bookmarked_as"

    Comment ||--o{ Comment : "replies_to"

    %% 多对多关系（通过中间表）
    Post ||--o{ PostTag : ""
    PostTag }o--|| Tag : ""

    %% 自引用多对多（关注关系）
    User ||--o{ Follow : "follower"
    User ||--o{ Follow : "following"
```

## 模块化 ERD 图

### 1. 用户系统模块

```mermaid
erDiagram
    User {
        string id PK
        string email UK "用户邮箱，唯一标识"
        string name "用户昵称"
        string avatarUrl "头像URL"
        text bio "个人简介"
        json socialLinks "社交链接JSON"
        Role role "用户角色：USER|ADMIN"
        UserStatus status "用户状态：ACTIVE|BANNED"
        string passwordHash "密码哈希，OAuth用户为null"
        datetime createdAt "创建时间"
        datetime updatedAt "更新时间"
        datetime lastLoginAt "最后登录时间"
    }

    Role {
        USER "普通用户"
        ADMIN "管理员"
    }

    UserStatus {
        ACTIVE "活跃状态"
        BANNED "封禁状态"
    }

    Role ||--o{ User : has
    UserStatus ||--o{ User : has
```

### 2. 博客模块

```mermaid
erDiagram
    User {
        string id PK
        string name
        Role role
    }

    Post {
        string id PK
        string slug UK "URL友好标识符"
        string title "文章标题"
        text content "文章正文"
        string excerpt "文章摘要"
        boolean published "是否发布"
        boolean isPinned "是否置顶"
        string canonicalUrl "SEO规范URL"
        string seoTitle "SEO标题"
        string seoDescription "SEO描述"
        int viewCount "浏览量"
        datetime createdAt "创建时间"
        datetime updatedAt "更新时间"
        datetime publishedAt "发布时间"
        string authorId FK
        string seriesId FK
    }

    Series {
        string id PK
        string title "系列标题"
        string slug UK "URL友好标识符"
        text description "系列描述"
        string coverUrl "系列封面"
        int sortOrder "排序权重"
        datetime createdAt
        datetime updatedAt
        string authorId FK
    }

    Tag {
        string id PK
        string name UK "标签名称"
        string slug UK "URL友好标识符"
        string description "标签描述"
        string color "标签颜色"
        int postsCount "使用计数"
        datetime createdAt
        datetime updatedAt
    }

    PostTag {
        string postId PK,FK
        string tagId PK,FK
        datetime createdAt
    }

    %% 关系
    User ||--o{ Post : "authors"
    User ||--o{ Series : "creates"
    Series ||--o{ Post : "contains"
    Post ||--o{ PostTag : ""
    PostTag }o--|| Tag : ""
```

### 3. 社交动态模块

```mermaid
erDiagram
    User {
        string id PK
        string name
        string avatarUrl
    }

    Activity {
        string id PK
        text content "动态内容"
        json imageUrls "图片URL数组"
        boolean isPinned "是否置顶"
        datetime createdAt "创建时间"
        datetime updatedAt "更新时间"
        string authorId FK
    }

    Follow {
        string followerId PK,FK "关注者ID"
        string followingId PK,FK "被关注者ID"
        datetime createdAt "关注时间"
    }

    %% 关系
    User ||--o{ Activity : "publishes"
    User ||--o{ Follow : "as_follower"
    User ||--o{ Follow : "as_following"
```

### 4. 通用交互模块

```mermaid
erDiagram
    User {
        string id PK
        string name
    }

    Post {
        string id PK
        string title
    }

    Activity {
        string id PK
        text content
    }

    Comment {
        string id PK
        text content "评论内容"
        datetime createdAt "创建时间"
        datetime updatedAt "更新时间"
        string authorId FK "评论者ID"
        string postId FK "文章ID（可空）"
        string activityId FK "动态ID（可空）"
        string parentId FK "父评论ID（可空）"
    }

    Like {
        string id PK
        datetime createdAt "点赞时间"
        string authorId FK "点赞者ID"
        string postId FK "文章ID（可空）"
        string activityId FK "动态ID（可空）"
    }

    %% 关系
    User ||--o{ Comment : "writes"
    User ||--o{ Like : "gives"
    Post ||--o{ Comment : "receives"
    Activity ||--o{ Comment : "receives"
    Post ||--o{ Like : "receives"
    Activity ||--o{ Like : "receives"
    Comment ||--o{ Comment : "replies_to"
```

### 5. 用户功能模块

```mermaid
erDiagram
    User {
        string id PK
        string name
    }

    Post {
        string id PK
        string title
    }

    Bookmark {
        string id PK
        datetime createdAt "收藏时间"
        string userId FK "用户ID"
        string postId FK "文章ID"
    }

    %% 关系
    User ||--o{ Bookmark : "saves"
    Post ||--o{ Bookmark : "bookmarked_as"
```

## 关系类型说明

### 一对一关系 (1:1)

- 当前架构中无一对一关系
- 未来可扩展：User ↔ UserProfile

### 一对多关系 (1:N)

1. **User → Posts**: 用户（管理员）发布多篇文章
2. **User → Activities**: 用户发布多条动态
3. **User → Series**: 用户创建多个文章系列
4. **User → Comments**: 用户发表多条评论
5. **User → Likes**: 用户给出多个点赞
6. **User → Bookmarks**: 用户收藏多篇文章
7. **Series → Posts**: 系列包含多篇文章
8. **Post → Comments**: 文章收到多条评论
9. **Activity → Comments**: 动态收到多条评论
10. **Comment → Comments**: 评论的嵌套回复

### 多对多关系 (M:N)

1. **Post ↔ Tag**: 文章与标签的多对多关系（通过PostTag中间表）
2. **User ↔ User**: 用户关注关系（通过Follow自引用表）

### 多态关联

1. **Comment**: 既可以评论Post，也可以评论Activity
2. **Like**: 既可以点赞Post，也可以点赞Activity

## 索引设计图

```mermaid
graph TD
    subgraph "主键索引 (自动创建)"
        PK1[User.id]
        PK2[Post.id]
        PK3[Activity.id]
        PK4[Comment.id]
        PK5[Like.id]
    end

    subgraph "唯一索引 (业务约束)"
        UK1[User.email]
        UK2[Post.slug]
        UK3[Series.slug]
        UK4[Tag.name]
        UK5[Tag.slug]
    end

    subgraph "外键索引 (关联查询)"
        FK1[Post.authorId]
        FK2[Post.seriesId]
        FK3[Comment.authorId]
        FK4[Comment.postId]
        FK5[Comment.activityId]
    end

    subgraph "复合索引 (性能优化)"
        CI1[Post: published + publishedAt DESC]
        CI2[Like: authorId + postId]
        CI3[Like: authorId + activityId]
        CI4[Bookmark: userId + postId]
        CI5[Follow: followerId + followingId]
    end

    subgraph "排序索引 (时间序列)"
        SI1[Activity.createdAt DESC]
        SI2[Comment.createdAt DESC]
        SI3[Tag.postsCount DESC]
    end
```

## 数据流向图

```mermaid
graph LR
    subgraph "内容创建流"
        U1[User] -->|创建| P1[Post]
        U1 -->|创建| S1[Series]
        U1 -->|发布| A1[Activity]
        P1 -->|归属| S1
        P1 -->|关联| T1[Tag]
    end

    subgraph "社交互动流"
        U2[User] -->|关注| U3[User]
        U2 -->|评论| P1
        U2 -->|评论| A1
        U2 -->|点赞| P1
        U2 -->|点赞| A1
        U2 -->|收藏| P1
    end

    subgraph "内容消费流"
        P1 -->|展示给| U4[Visitor]
        A1 -->|展示给| U4
        C1[Comment] -->|展示给| U4
        L1[Like] -->|统计显示| U4
    end
```

## 权限控制图

```mermaid
graph TD
    subgraph "角色权限"
        ADMIN[管理员 ADMIN]
        USER[普通用户 USER]
        GUEST[访客 未登录]
    end

    subgraph "博客模块权限"
        BP1[发布文章]
        BP2[管理系列]
        BP3[标签管理]
        BP4[内容审核]
    end

    subgraph "社交模块权限"
        SP1[发布动态]
        SP2[评论互动]
        SP3[点赞收藏]
        SP4[关注用户]
    end

    subgraph "用户管理权限"
        UP1[用户列表]
        UP2[角色变更]
        UP3[状态管理]
        UP4[账号删除]
    end

    subgraph "状态控制"
        ACTIVE[活跃状态 ACTIVE]
        BANNED[封禁状态 BANNED]
    end

    %% 权限分配
    ADMIN --> BP1
    ADMIN --> BP2
    ADMIN --> BP3
    ADMIN --> BP4
    ADMIN --> UP1
    ADMIN --> UP2
    ADMIN --> UP3
    ADMIN --> UP4

    USER --> SP1
    USER --> SP2
    USER --> SP3
    USER --> SP4

    %% 状态控制
    ACTIVE --> SP1
    ACTIVE --> SP2
    ACTIVE --> SP3
    ACTIVE --> SP4

    BANNED -.-> |禁止| SP1
    BANNED -.-> |禁止| SP2
    BANNED -.-> |禁止| SP3
    BANNED -.-> |禁止| SP4
```

## 总结

本实体关系图完整展现了现代化博客项目的数据架构：

1. **11个核心模型**：覆盖用户系统、博客管理、社交互动、通用交互等全部业务场景
2. **清晰的模块分离**：博客模块和社交模块独立设计，互不干扰
3. **灵活的关系设计**：支持多态关联、嵌套回复、多对多标签等复杂业务需求
4. **完善的约束机制**：通过唯一索引、外键约束确保数据完整性
5. **性能优化导向**：19个精心设计的索引支持高频查询场景

该架构为项目提供了坚实的数据基础，支持从MVP到大规模应用的平滑演进。
