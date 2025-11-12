/**
 * 通用交互服务层
 * 导出评论和点赞的统一接口
 */

// 通用错误
export { InteractionTargetNotFoundError } from "./errors"

// 评论类型（从 DTO 导出）
export { type CommentTargetType } from "@/lib/dto/comments.dto"

// 评论服务
export {
  // 类型
  type CommentQueryOptions,
  type CreateCommentData,
  type CommentWithAuthor,
  CommentServiceError,
  CommentErrorCode,

  // 函数
  createComment,
  listComments,
  deleteComment,
  getCommentCount,
} from "./comments"

// 点赞服务
export {
  // 类型
  type LikeTargetType,
  type LikeStatus,
  type LikeUser,

  // 函数
  toggleLike,
  setLike,
  ensureLiked,
  ensureUnliked,
  getLikeStatus,
  getLikeUsers,
  getBatchLikeStatus,
  getLikeCount,
  clearUserLikes,
} from "./likes"

// 收藏服务
export {
  // 类型
  type BookmarkStatus,
  type BookmarkListItem,
  type BookmarkListResult,

  // 函数
  toggleBookmark,
  setBookmark,
  ensureBookmarked,
  ensureUnbookmarked,
  getBookmarkStatus,
  getUserBookmarks,
} from "./bookmarks"

// 通用类型
export type InteractionTargetType = "post" | "activity"

// 关注服务
export {
  FollowServiceError,
  type FollowServiceErrorCode,
  type FollowActionResult,
  type UnfollowActionResult,
  type PublicUserProfile,
  type FollowListItem,
  type FollowListResult,
  type FollowListOptions,
  type FollowStatus,
  type FollowStatusMap,
  followUser,
  unfollowUser,
  listFollowers,
  listFollowing,
  getFollowStatusBatch,
} from "./follow"

// 计数校验工具
export {
  type CountMismatch,
  type VerifyResult,
  verifyActivityLikesCount,
  verifyActivityCommentsCount,
  fixCountMismatches,
  verifyAndFixCounts,
} from "./verify-counts"
