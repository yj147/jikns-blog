/**
 * 组件相关类型定义
 * UI 组件的 Props 接口和状态类型
 */

import { ReactNode, HTMLAttributes, ComponentProps } from "react"
import { LucideIcon } from "lucide-react"
import { VariantProps } from "class-variance-authority"

// ============================================================================
// 基础组件类型
// ============================================================================

export interface BaseComponentProps {
  children?: ReactNode
  className?: string
  id?: string
}

export interface WithLoadingState {
  loading?: boolean
  loadingText?: string
}

export interface WithErrorState {
  error?: string | null
  onRetry?: () => void
}

export interface WithDisabledState {
  disabled?: boolean
  disabledReason?: string
}

// ============================================================================
// 按钮组件类型
// ============================================================================

export interface ButtonProps
  extends HTMLAttributes<HTMLButtonElement>,
    WithLoadingState,
    WithDisabledState {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
  type?: "button" | "submit" | "reset"
  leftIcon?: LucideIcon
  rightIcon?: LucideIcon
  fullWidth?: boolean
}

// ============================================================================
// 表单组件类型
// ============================================================================

export interface FormFieldProps extends BaseComponentProps {
  label?: string
  description?: string
  error?: string
  required?: boolean
  htmlFor?: string
}

export interface InputProps
  extends Omit<HTMLAttributes<HTMLInputElement>, "onChange" | "onBlur" | "onFocus">,
    WithDisabledState {
  type?: "text" | "email" | "password" | "url" | "tel" | "search" | "number"
  placeholder?: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  onFocus?: () => void
  leftIcon?: LucideIcon
  rightIcon?: LucideIcon
  clearable?: boolean
  maxLength?: number
}

export interface TextareaProps
  extends Omit<HTMLAttributes<HTMLTextAreaElement>, "onChange" | "onBlur" | "onFocus">,
    WithDisabledState {
  placeholder?: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  onFocus?: () => void
  rows?: number
  maxLength?: number
  resize?: "none" | "vertical" | "horizontal" | "both"
}

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
  group?: string
}

export interface SelectProps extends BaseComponentProps, WithDisabledState {
  options: SelectOption[]
  value?: string | number
  defaultValue?: string | number
  placeholder?: string
  onChange?: (value: string | number) => void
  searchable?: boolean
  clearable?: boolean
  multiple?: boolean
  loading?: boolean
}

// ============================================================================
// 数据展示组件类型
// ============================================================================

export interface TableColumn<T = unknown> {
  key: string
  title: string
  width?: string | number
  align?: "left" | "center" | "right"
  sortable?: boolean
  render?: (value: unknown, record: T, index: number) => ReactNode
  className?: string
}

export interface TableProps<T = unknown> extends BaseComponentProps {
  data: T[]
  columns: TableColumn<T>[]
  loading?: boolean
  empty?: ReactNode
  pagination?: PaginationProps
  sortBy?: string
  sortOrder?: "asc" | "desc"
  onSort?: (key: string, order: "asc" | "desc") => void
  onRowClick?: (record: T, index: number) => void
  rowKey?: keyof T | ((record: T) => string | number)
  selectable?: boolean
  selectedRowKeys?: (string | number)[]
  onSelectionChange?: (selectedRowKeys: (string | number)[]) => void
}

export interface PaginationProps extends BaseComponentProps {
  current: number
  total: number
  pageSize: number
  showSizeChanger?: boolean
  showQuickJumper?: boolean
  showTotal?: boolean
  onChange?: (page: number, pageSize: number) => void
  pageSizeOptions?: number[]
}

// ============================================================================
// 卡片和列表组件类型
// ============================================================================

export interface CardProps extends BaseComponentProps {
  title?: ReactNode
  description?: ReactNode
  extra?: ReactNode
  cover?: ReactNode
  actions?: ReactNode[]
  hoverable?: boolean
  bordered?: boolean
  loading?: boolean
}

export interface ListItem {
  id: string | number
  title: ReactNode
  description?: ReactNode
  avatar?: ReactNode
  extra?: ReactNode
  actions?: ReactNode[]
  href?: string
  onClick?: () => void
}

export interface ListProps extends BaseComponentProps {
  items: ListItem[]
  loading?: boolean
  empty?: ReactNode
  bordered?: boolean
  split?: boolean
  size?: "small" | "default" | "large"
  onItemClick?: (item: ListItem, index: number) => void
}

// ============================================================================
// 导航组件类型
// ============================================================================

export interface NavigationItem {
  key: string
  label: ReactNode
  href?: string
  icon?: LucideIcon
  badge?: number | string
  children?: NavigationItem[]
  disabled?: boolean
  active?: boolean
  external?: boolean
}

export interface NavigationProps extends BaseComponentProps {
  items: NavigationItem[]
  activeKey?: string
  collapsed?: boolean
  onItemClick?: (item: NavigationItem) => void
  mode?: "horizontal" | "vertical"
}

export interface BreadcrumbItem {
  title: ReactNode
  href?: string
  icon?: LucideIcon
}

export interface BreadcrumbProps extends BaseComponentProps {
  items: BreadcrumbItem[]
  separator?: ReactNode
}

// ============================================================================
// 反馈组件类型
// ============================================================================

export interface AlertProps extends BaseComponentProps {
  type?: "info" | "success" | "warning" | "error"
  title?: ReactNode
  description?: ReactNode
  closable?: boolean
  onClose?: () => void
  showIcon?: boolean
  action?: ReactNode
}

export interface ToastProps {
  id: string
  title: string
  description?: string
  type?: "default" | "success" | "error" | "warning" | "info"
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
  onClose?: () => void
}

export interface ModalProps extends BaseComponentProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  footer?: ReactNode
  closable?: boolean
  maskClosable?: boolean
  width?: string | number
  centered?: boolean
  loading?: boolean
}

export interface ConfirmDialogProps {
  open: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  title: ReactNode
  description: ReactNode
  confirmText?: string
  cancelText?: string
  type?: "info" | "warning" | "error"
  loading?: boolean
}

// ============================================================================
// 布局组件类型
// ============================================================================

export interface ContainerProps extends BaseComponentProps {
  size?: "sm" | "md" | "lg" | "xl" | "full"
  padding?: boolean
  center?: boolean
}

export interface GridProps extends BaseComponentProps {
  cols?: 1 | 2 | 3 | 4 | 5 | 6 | 12
  gap?: "sm" | "md" | "lg"
  responsive?: {
    sm?: number
    md?: number
    lg?: number
    xl?: number
  }
}

export interface FlexProps extends BaseComponentProps {
  direction?: "row" | "column"
  align?: "start" | "center" | "end" | "stretch"
  justify?: "start" | "center" | "end" | "between" | "around" | "evenly"
  wrap?: boolean
  gap?: "sm" | "md" | "lg"
}

// ============================================================================
// 媒体组件类型
// ============================================================================

export interface AvatarProps extends BaseComponentProps {
  src?: string
  alt?: string
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  shape?: "circle" | "square"
  fallback?: ReactNode
  online?: boolean
}

export interface ImageProps extends BaseComponentProps {
  src: string
  alt: string
  width?: number
  height?: number
  aspectRatio?: string
  fit?: "cover" | "contain" | "fill" | "scale-down"
  loading?: "lazy" | "eager"
  placeholder?: ReactNode
  fallback?: ReactNode
  onLoad?: () => void
  onError?: () => void
}

// ============================================================================
// 编辑器组件类型
// ============================================================================

export interface MarkdownEditorProps extends BaseComponentProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  preview?: boolean
  toolbar?: boolean
  maxLength?: number
  autoFocus?: boolean
  disabled?: boolean
  onSave?: (value: string) => void
  onCancel?: () => void
}

export interface RichTextEditorProps extends BaseComponentProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  features?: {
    bold?: boolean
    italic?: boolean
    underline?: boolean
    strikethrough?: boolean
    link?: boolean
    image?: boolean
    code?: boolean
    blockquote?: boolean
    orderedList?: boolean
    unorderedList?: boolean
    heading?: boolean
  }
  onImageUpload?: (file: File) => Promise<string>
}

// ============================================================================
// 搜索组件类型
// ============================================================================

export interface SearchBoxProps extends BaseComponentProps {
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  onSearch?: (value: string) => void
  onClear?: () => void
  loading?: boolean
  suggestions?: string[]
  onSuggestionClick?: (suggestion: string) => void
  debounceMs?: number
}

// ============================================================================
// 过滤器组件类型
// ============================================================================

export interface FilterOption {
  key: string
  label: string
  type: "select" | "multiSelect" | "dateRange" | "range" | "search"
  options?: { value: string; label: string }[]
  placeholder?: string
  min?: number
  max?: number
}

export interface FilterProps extends BaseComponentProps {
  options: FilterOption[]
  values: Record<string, unknown>
  onChange: (values: Record<string, unknown>) => void
  onReset?: () => void
  collapsed?: boolean
}

// ============================================================================
// 进度和状态组件类型
// ============================================================================

export interface ProgressProps extends BaseComponentProps {
  value: number
  max?: number
  showText?: boolean
  color?: string
  size?: "sm" | "md" | "lg"
  variant?: "linear" | "circular"
}

export interface SkeletonProps extends BaseComponentProps {
  lines?: number
  avatar?: boolean
  title?: boolean
  loading?: boolean
}

export interface EmptyStateProps extends BaseComponentProps {
  title: ReactNode
  description?: ReactNode
  image?: ReactNode
  action?: ReactNode
}

// ============================================================================
// 组合组件类型
// ============================================================================

export interface StatsCardProps extends BaseComponentProps {
  title: string
  value: string | number
  change?: {
    value: number
    type: "increase" | "decrease"
    period: string
  }
  icon?: LucideIcon
  trend?: number[]
  loading?: boolean
  href?: string
}

export interface TimelineItem {
  id: string
  title: ReactNode
  description?: ReactNode
  time: string
  type?: "default" | "success" | "warning" | "error"
  icon?: LucideIcon
  actions?: ReactNode[]
}

export interface TimelineProps extends BaseComponentProps {
  items: TimelineItem[]
  loading?: boolean
  loadMore?: () => void
  hasMore?: boolean
}

// ============================================================================
// 主题相关类型
// ============================================================================

export interface ThemeConfig {
  mode: "light" | "dark" | "system"
  primaryColor?: string
  borderRadius?: "none" | "sm" | "md" | "lg" | "full"
  fontFamily?: string
}

export interface ThemeProviderProps extends BaseComponentProps {
  defaultTheme?: ThemeConfig
  storageKey?: string
  enableColorScheme?: boolean
}

// ============================================================================
// 响应式类型
// ============================================================================

export interface ResponsiveConfig<T> {
  xs?: T
  sm?: T
  md?: T
  lg?: T
  xl?: T
  "2xl"?: T
}

export interface MediaQuery {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isLarge: boolean
  width: number
  height: number
}
