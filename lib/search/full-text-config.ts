/**
 * 全文检索配置常量
 * 统一管理 PostgreSQL text search configuration 名称与时间衰减策略
 */
export const SEARCH_FULLTEXT_CONFIG = "simple"

// 时间衰减半衰期（天），用于相关性排序
export const SEARCH_TIME_DECAY_HALF_LIFE_DAYS = 45
