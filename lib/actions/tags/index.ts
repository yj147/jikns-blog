/**
 * 标签相关的 Server Actions 统一导出
 *
 * 注意：此文件不使用 "use server"，因为各个子模块已经标记了
 */

export type { ApiResponse, TagData, TagListPagination, GetTagsOptions } from "./queries"
export { getTags, getTag, getPopularTags, searchTags } from "./queries"

export type { CreateTagData, UpdateTagData } from "./mutations"
export { createTag, updateTag, deleteTag, mergeTags } from "./mutations"

export type {
  TagCandidateData,
  TagCandidateListPagination,
  GetTagCandidatesOptions,
} from "./candidates"
export { getTagCandidates, promoteTagCandidate } from "./candidates"
