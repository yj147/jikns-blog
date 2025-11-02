/**
 * 实用工具类型定义
 * 通用的类型工具和辅助类型
 */

// ============================================================================
// 基础工具类型
// ============================================================================

/**
 * 使指定属性为可选
 */
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/**
 * 使指定属性为必需
 */
export type MakeRequired<T, K extends keyof T> = Omit<T, K> &
  Pick<T, K> & {
    [P in K]-?: T[P]
  }

/**
 * 深度可选
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * 深度必需
 */
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P]
}

/**
 * 可为空的类型
 */
export type Nullable<T> = T | null

/**
 * 可为未定义的类型
 */
export type Maybe<T> = T | undefined

/**
 * 可为空或未定义的类型
 */
export type OptionalValue<T> = T | null | undefined

/**
 * 非空类型
 */
export type NonNullable<T> = T extends null | undefined ? never : T

/**
 * 提取数组元素类型
 */
export type ArrayElement<T extends ReadonlyArray<unknown>> =
  T extends ReadonlyArray<infer E> ? E : never

/**
 * 提取 Promise 返回值类型
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T

/**
 * 提取函数返回值类型
 */
export type ReturnType<T extends (...args: any[]) => any> = T extends (...args: any[]) => infer R
  ? R
  : any

/**
 * 提取函数参数类型
 */
export type Parameters<T extends (...args: any[]) => any> = T extends (...args: infer P) => any
  ? P
  : never

// ============================================================================
// 对象工具类型
// ============================================================================

/**
 * 创建严格的对象类型 - 不允许额外属性
 */
export type Exact<T extends Record<string, unknown>> = T

/**
 * 从联合类型中排除指定类型
 */
export type Exclude<T, U> = T extends U ? never : T

/**
 * 从联合类型中提取指定类型
 */
export type Extract<T, U> = T extends U ? T : never

/**
 * 获取对象的键类型
 */
export type Keys<T> = keyof T

/**
 * 获取对象的值类型
 */
export type Values<T> = T[keyof T]

/**
 * 获取对象特定键的值类型
 */
export type ValueOf<T, K extends keyof T> = T[K]

/**
 * 创建只读对象类型
 */
export type Immutable<T> = {
  readonly [P in keyof T]: T[P] extends object ? Immutable<T[P]> : T[P]
}

/**
 * 移除只读修饰符
 */
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P]
}

/**
 * 扁平化嵌套对象类型
 */
export type Flatten<T extends Record<string, any>> = {
  [K in keyof T]: T[K] extends Record<string, any>
    ? T[K] extends Function
      ? T[K]
      : Flatten<T[K]>
    : T[K]
}

// ============================================================================
// 字符串工具类型
// ============================================================================

/**
 * 首字母大写
 */
export type Capitalize<S extends string> = S extends `${infer F}${infer R}`
  ? `${Uppercase<F>}${R}`
  : S

/**
 * 首字母小写
 */
export type Uncapitalize<S extends string> = S extends `${infer F}${infer R}`
  ? `${Lowercase<F>}${R}`
  : S

/**
 * 字符串字面量类型
 */
export type StringLiteral<T> = T extends string ? (string extends T ? never : T) : never

/**
 * 路径字符串类型
 */
export type PathString = `/${string}`

/**
 * 邮箱字符串类型
 */
export type EmailString = `${string}@${string}.${string}`

/**
 * URL 字符串类型
 */
export type UrlString = `http${"s" | ""}://${string}`

/**
 * 十六进制颜色字符串类型
 */
export type HexColor = `#${string}`

// ============================================================================
// 数组工具类型
// ============================================================================

/**
 * 非空数组类型
 */
export type NonEmptyArray<T> = [T, ...T[]]

/**
 * 只读数组类型
 */
export type ReadonlyArray<T> = readonly T[]

/**
 * 元组类型
 */
export type Tuple<T extends ReadonlyArray<any>> = T

/**
 * 元组转联合类型
 */
export type TupleToUnion<T extends ReadonlyArray<any>> = T[number]

/**
 * 数组长度类型
 */
export type Length<T extends ReadonlyArray<any>> = T["length"]

/**
 * 数组第一个元素类型
 */
export type Head<T extends ReadonlyArray<any>> = T extends readonly [infer H, ...any[]] ? H : never

/**
 * 数组尾部类型
 */
export type Tail<T extends ReadonlyArray<any>> = T extends readonly [any, ...infer Tail] ? Tail : []

// ============================================================================
// 函数工具类型
// ============================================================================

/**
 * 异步函数类型
 */
export type AsyncFunction<T extends any[] = any[], R = any> = (...args: T) => Promise<R>

/**
 * 事件处理函数类型
 */
export type EventHandler<T = Event> = (event: T) => void

/**
 * 回调函数类型
 */
export type Callback<T = void> = () => T

/**
 * 错误回调函数类型
 */
export type ErrorCallback = (error: Error) => void

/**
 * 带参数的回调函数类型
 */
export type CallbackWithArgs<T extends any[], R = void> = (...args: T) => R

/**
 * 条件回调函数类型
 */
export type ConditionalCallback<T, R = void> = T extends undefined ? () => R : (arg: T) => R

// ============================================================================
// 条件类型工具
// ============================================================================

/**
 * 如果条件为真则返回类型 T，否则返回类型 F
 */
export type If<C extends boolean, T, F> = C extends true ? T : F

/**
 * 检查类型是否相等
 */
export type Equals<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false

/**
 * 检查类型是否为 never
 */
export type IsNever<T> = [T] extends [never] ? true : false

/**
 * 检查类型是否为 any
 */
export type IsAny<T> = 0 extends 1 & T ? true : false

/**
 * 检查类型是否为 unknown
 */
export type IsUnknown<T> = IsAny<T> extends true ? false : unknown extends T ? true : false

/**
 * 检查类型是否为函数
 */
export type IsFunction<T> = T extends Function ? true : false

/**
 * 检查类型是否为对象
 */
export type IsObject<T> = T extends object ? (T extends any[] ? false : true) : false

/**
 * 检查类型是否为数组
 */
export type IsArray<T> = T extends any[] ? true : false

// ============================================================================
// 品牌类型（Branded Types）
// ============================================================================

/**
 * 品牌类型，用于创建名义类型
 */
export type Brand<T, B> = T & { readonly __brand: B }

/**
 * 用户 ID 品牌类型
 */
export type UserId = Brand<string, "UserId">

/**
 * 博客文章 ID 品牌类型
 */
export type PostId = Brand<string, "PostId">

/**
 * 时间戳品牌类型
 */
export type Timestamp = Brand<number, "Timestamp">

/**
 * 邮箱品牌类型
 */
export type Email = Brand<string, "Email">

/**
 * URL 品牌类型
 */
export type Url = Brand<string, "Url">

/**
 * JWT Token 品牌类型
 */
export type JwtToken = Brand<string, "JwtToken">

/**
 * CSRF Token 品牌类型
 */
export type CsrfToken = Brand<string, "CsrfToken">

// ============================================================================
// 高级工具类型
// ============================================================================

/**
 * 创建联合类型的分布式条件类型
 */
export type DistributiveConditional<T, U> = T extends U ? T : never

/**
 * 递归合并类型
 */
export type DeepMerge<T, U> = {
  [K in keyof T | keyof U]: K extends keyof U
    ? K extends keyof T
      ? T[K] extends object
        ? U[K] extends object
          ? DeepMerge<T[K], U[K]>
          : U[K]
        : U[K]
      : U[K]
    : K extends keyof T
      ? T[K]
      : never
}

/**
 * 类型安全的枚举
 */
export type Enum<T extends Record<string, string | number>> = T[keyof T]

/**
 * 创建字面量联合类型
 */
export type LiteralUnion<T extends U, U = string> = T | (U & Record<never, never>)

/**
 * 递归键路径类型
 */
export type KeyPath<T, K extends keyof T = keyof T> = K extends string | number
  ? T[K] extends Record<string, any>
    ? T[K] extends ArrayLike<any>
      ? K | `${K}.${KeyPath<T[K], Exclude<keyof T[K], keyof any[]>>}`
      : K | `${K}.${KeyPath<T[K], keyof T[K]>}`
    : K
  : never

/**
 * 根据键路径获取值类型
 */
export type GetValueByPath<T, P extends string> = P extends keyof T
  ? T[P]
  : P extends `${infer K}.${infer Rest}`
    ? K extends keyof T
      ? GetValueByPath<T[K], Rest>
      : never
    : never

// ============================================================================
// 环境相关类型
// ============================================================================

/**
 * 环境变量类型
 */
export type Environment = "development" | "production" | "test"

/**
 * 日志级别类型
 */
export type LogLevel = "debug" | "info" | "warn" | "error"

/**
 * 主题模式类型
 */
export type ThemeMode = "light" | "dark" | "system"

/**
 * 语言代码类型
 */
export type LanguageCode = "en" | "zh-CN" | "zh-TW" | "ja" | "ko" | "es" | "fr" | "de"

/**
 * 时区类型
 */
export type TimeZone = string

/**
 * 货币代码类型
 */
export type CurrencyCode = "USD" | "CNY" | "EUR" | "JPY" | "GBP"

// ============================================================================
// 状态管理相关类型
// ============================================================================

/**
 * 加载状态类型
 */
export type LoadingState = "idle" | "loading" | "success" | "error"

/**
 * 异步操作状态类型
 */
export interface AsyncState<T = any, E = Error> {
  data: T | null
  loading: boolean
  error: E | null
  lastUpdated: number | null
}

/**
 * 分页状态类型
 */
export interface PaginationState {
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

/**
 * 排序状态类型
 */
export interface SortState {
  field: string
  order: "asc" | "desc"
}

/**
 * 过滤器状态类型
 */
export type FilterState<T = Record<string, any>> = T

// ============================================================================
// 时间相关类型
// ============================================================================

/**
 * ISO 日期字符串类型
 */
export type ISODateString = string

/**
 * 时间格式类型
 */
export type DateFormat = "YYYY-MM-DD" | "YYYY/MM/DD" | "MM/DD/YYYY" | "DD/MM/YYYY"

/**
 * 相对时间类型
 */
export type RelativeTime = "just now" | "a few minutes ago" | "an hour ago" | "yesterday" | string

/**
 * 时间单位类型
 */
export type TimeUnit = "second" | "minute" | "hour" | "day" | "week" | "month" | "year"
