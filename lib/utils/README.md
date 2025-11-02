# 工具函数库

完整的模块化工具函数集合，支持现代化博客项目的各种需求。

## 功能模块

### 1. 分页工具 (`pagination.ts`)

支持游标分页和偏移分页两种模式的完整分页解决方案。

```typescript
import { 
  createOffsetPagination, 
  createCursorPagination, 
  createPaginationMeta 
} from '@/lib/utils/pagination';

// 偏移分页
const pagination = createOffsetPagination({ page: 1, pageSize: 20 });
const meta = createPaginationMeta(data, totalCount, { page: 1, pageSize: 20 });

// 游标分页  
const cursorPagination = createCursorPagination({ cursor: 'abc123', limit: 10 });
const cursor = generateCursor('item-id', new Date());
```

**主要功能：**
- ✅ 偏移分页和游标分页支持
- ✅ 自动参数验证和限制
- ✅ 元数据生成（总页数、下一页等）
- ✅ Base64 游标编码/解码
- ✅ TypeScript 类型安全

### 2. Slug 工具 (`slug.ts`)

URL 友好的 slug 生成，支持中文内容转拼音。

```typescript
import { createSlug, createUniqueSlug, validateSlug } from '@/lib/utils/slug';

// 基础 slug 生成
const slug = createSlug('JavaScript 开发教程');
// 输出: 'javascript-kai-fa-jiao-cheng'

// 唯一 slug 生成（带去重）
const uniqueSlug = await createUniqueSlug(
  '博客标题',
  async (slug) => await checkSlugExists(slug)
);

// Slug 验证
const validation = validateSlug('valid-slug');
```

**主要功能：**
- ✅ 中文转拼音映射（1000+ 常用汉字）
- ✅ 特殊字符处理和替换
- ✅ 长度限制和截断优化
- ✅ 异步去重机制
- ✅ 严格模式和宽松模式
- ✅ 批量 slug 生成

### 3. 日期工具 (`date.ts`)

中文友好的日期格式化和处理工具。

```typescript
import { 
  formatDateChinese, 
  formatRelativeTime, 
  getFriendlyTimeDescription 
} from '@/lib/utils/date';

// 中文日期格式化
const formatted = formatDateChinese(new Date(), {
  format: 'long',
  includeTime: true,
  timezone: 'Asia/Shanghai'
});
// 输出: '2024年8月26日 星期一 14:30:45'

// 相对时间
const relative = formatRelativeTime(lastWeek);
// 输出: '7天前'

// 友好时间描述
const friendly = getFriendlyTimeDescription(yesterday);
// 输出: '昨天 15:30'
```

**主要功能：**
- ✅ 多种中文日期格式（完整/长/中/短/相对/ISO）
- ✅ 时区支持和转换
- ✅ 相对时间计算（刚刚、分钟前、天前等）
- ✅ 友好时间描述（今天、昨天、星期几）
- ✅ 年龄计算和持续时间格式化
- ✅ 安全的日期解析和验证

### 4. 内容清洗 (`content.ts`)

防 XSS 的内容安全处理和清洗工具。

```typescript
import { 
  sanitizeHtml, 
  sanitizeText, 
  validateContentSecurity,
  generateExcerpt,
  estimateReadingTime 
} from '@/lib/utils/content';

// HTML 内容清洗
const cleanHtml = sanitizeHtml('<script>alert("xss")</script><p>安全内容</p>');
// 输出: '<p>安全内容</p>'

// 纯文本清洗
const cleanText = sanitizeText('<p>Hello <strong>World</strong>!</p>');
// 输出: 'Hello World!'

// 内容安全验证
const security = validateContentSecurity(userInput);
if (!security.isSafe) {
  console.log('检测到安全问题:', security.issues);
}

// 内容摘要生成
const excerpt = generateExcerpt(longContent, 200);

// 阅读时间估算
const readingTime = estimateReadingTime(content);
// 输出: 3 (分钟)
```

**主要功能：**
- ✅ XSS 防护和 HTML 清洗
- ✅ 可配置的标签和属性白名单
- ✅ 文本格式化和处理
- ✅ HTML 实体编码/解码
- ✅ 内容安全性验证
- ✅ 智能摘要生成
- ✅ 阅读时间估算（支持中英文）
- ✅ 语言检测（中文/英文/混合）

### 5. API 错误处理 (`api-errors.ts`)

统一的 API 错误创建、分类和处理系统。

```typescript
import { 
  ApiErrorType,
  createApiError,
  createSuccessResponse,
  nextApiErrorResponse,
  handleUnknownError 
} from '@/lib/utils/api-errors';

// 创建标准化错误
const error = createApiError(
  ApiErrorType.NOT_FOUND, 
  '用户不存在',
  { userId: 123 }
);

// 创建成功响应
const success = createSuccessResponse(
  { id: 1, name: '用户名' },
  '操作成功'
);

// Next.js API 错误响应
return nextApiErrorResponse(error);

// 处理未知错误
try {
  // 危险操作
} catch (err) {
  const apiError = handleUnknownError(err, requestId);
  return nextApiErrorResponse(apiError);
}
```

**主要功能：**
- ✅ 标准化错误类型和状态码映射
- ✅ 错误严重级别分类
- ✅ 自动请求 ID 生成
- ✅ Next.js API 响应集成
- ✅ Prisma 错误处理
- ✅ 错误统计和监控
- ✅ 结构化错误日志

### 6. 通用工具 (`index.ts`)

常用的通用工具函数集合。

```typescript
import { 
  delay,
  debounce,
  throttle,
  retry,
  deepClone,
  unique,
  formatFileSize,
  isValidEmail 
} from '@/lib/utils';

// 延迟和重试
await delay(1000);
const result = await retry(unstableOperation, 3, 1000);

// 防抖和节流
const debouncedFn = debounce(expensiveFunction, 300);
const throttledFn = throttle(frequentFunction, 100);

// 数据处理
const cloned = deepClone(complexObject);
const uniqueItems = unique(duplicateArray, 'id');

// 格式化和验证
const size = formatFileSize(1024000); // '1.0 MB'
const isValid = isValidEmail('user@example.com');
```

**主要功能：**
- ✅ 异步工具（延迟、重试、防抖、节流）
- ✅ 数据处理（深拷贝、去重、分组、分块）
- ✅ 格式化工具（文件大小、数字千分位）
- ✅ 验证工具（邮箱、URL 格式）
- ✅ 搜索高亮和关键词处理
- ✅ 安全的 JSON 处理

## 设计特色

### 🌏 国际化支持
- 完整的中文友好处理
- 中文拼音转换（1000+ 汉字映射）
- 中文日期格式化
- 双语内容处理

### 🔒 安全优先
- 内置 XSS 防护
- 输入验证和清洗
- 错误处理和日志记录
- 类型安全保障

### ⚡ 性能优化
- 模块化按需导入
- 函数级别的优化
- 内存使用控制
- 高效算法实现

### 🧪 测试覆盖
- 单元测试覆盖
- 边界情况处理
- 错误路径测试
- 性能基准测试

## 使用示例

### 博客文章处理完整流程

```typescript
import { 
  createSlug, 
  sanitizeHtml, 
  generateExcerpt, 
  estimateReadingTime,
  formatDateChinese 
} from '@/lib/utils';

async function processPost(rawPost: any) {
  // 生成 slug
  const slug = await createUniqueSlug(
    rawPost.title,
    async (slug) => await Post.findFirst({ where: { slug } }) !== null
  );

  // 清洗内容
  const content = sanitizeHtml(rawPost.content, {
    allowLinks: true,
    allowImages: true,
    maxLength: 50000
  });

  // 生成摘要
  const excerpt = generateExcerpt(content, 200);

  // 计算阅读时间
  const readingTime = estimateReadingTime(content);

  // 格式化发布时间
  const publishedAt = formatDateChinese(new Date(), {
    format: 'long',
    includeTime: true
  });

  return {
    ...rawPost,
    slug,
    content,
    excerpt,
    readingTime,
    publishedAt
  };
}
```

### API 错误处理标准流程

```typescript
import { 
  handleUnknownError,
  nextApiErrorResponse,
  nextApiSuccessResponse,
  generateRequestId 
} from '@/lib/utils';

export async function POST(request: Request) {
  const requestId = generateRequestId();

  try {
    // 业务逻辑
    const result = await processRequest(request);
    
    return nextApiSuccessResponse(
      result,
      '操作成功',
      requestId
    );
  } catch (error) {
    const apiError = handleUnknownError(
      error,
      requestId,
      request.url,
      request.method
    );

    // 自动记录错误日志
    logError(apiError);

    return nextApiErrorResponse(apiError, requestId);
  }
}
```

## 测试

```bash
# 运行基础工具函数测试
pnpm test tests/unit/utils-basic.test.ts

# 运行完整测试套件
pnpm test tests/unit/utils.test.ts
```

## 贡献

工具函数库遵循以下原则：

1. **纯函数优先** - 无副作用，可预测的输出
2. **TypeScript 严格模式** - 完整的类型安全
3. **错误处理** - 优雅的错误处理和恢复
4. **性能考虑** - 避免不必要的计算和内存使用
5. **测试覆盖** - 每个功能都需要对应的单元测试

## License

MIT License - 详见项目根目录 LICENSE 文件。