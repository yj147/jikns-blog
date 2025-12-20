/**
 * 搜索模块统一导出
 * Phase 11 / M2 / T2.1 - 代码组织优化
 */

// 导出所有类型
export type {
  SearchPostsParams,
  SearchPostResult,
  SearchActivitiesParams,
  SearchActivityResult,
  SearchUsersParams,
  SearchUserResult,
  SearchTagsParams,
  SearchTagResult,
  SearchQueryResult,
} from "./shared/types"

// 导出所有搜索函数
export { searchPosts, searchPostSuggestions } from "./posts"
export { searchActivities } from "./activities"
export { searchUsers } from "./users"
export { searchTags } from "./tags"
export { unifiedSearch } from "./unified-search"
