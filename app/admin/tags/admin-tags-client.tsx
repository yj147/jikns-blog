"use client"

import { useCallback, useState } from "react"
import type {
  ApiResponse,
  CreateTagData,
  GetTagsOptions,
  TagData,
  TagListPagination,
  TagCandidateData,
  TagCandidateListPagination,
  GetTagCandidatesOptions,
  UpdateTagData,
} from "@/lib/actions/tags"
import { TagDialog } from "@/components/admin/tag-dialog"
import { toast } from "sonner"
import { TagQueryPanel } from "./tag-query-panel"
import { TagTableView } from "./tag-table-view"
import { TagDeleteDialog } from "./tag-delete-dialog"
import { useAdminTagsState } from "@/hooks/use-admin-tags-state"
import { TagCandidateReview } from "./tag-candidate-review"

interface AdminTagsClientProps {
  initialTags: TagData[]
  initialPagination: TagListPagination
  initialCandidates: TagCandidateData[]
  initialCandidatePagination: TagCandidateListPagination
  initialCandidateError?: { code: string; message: string } | null
  getTagsAction: (
    options: Partial<GetTagsOptions>
  ) => Promise<ApiResponse<{ tags: TagData[]; pagination: TagListPagination }>>
  createTagAction: (payload: CreateTagData) => Promise<ApiResponse<{ tag: TagData }>>
  updateTagAction: (tagId: string, payload: UpdateTagData) => Promise<ApiResponse<{ tag: TagData }>>
  deleteTagAction: (tagId: string) => Promise<ApiResponse<{ message: string }>>
  getTagCandidatesAction: (
    options: Partial<GetTagCandidatesOptions>
  ) => Promise<
    ApiResponse<{ candidates: TagCandidateData[]; pagination: TagCandidateListPagination }>
  >
  promoteTagCandidateAction: (candidateId: string) => Promise<ApiResponse<{ tag: TagData }>>
}

export function AdminTagsClient({
  initialTags,
  initialPagination,
  initialCandidates,
  initialCandidatePagination,
  initialCandidateError = null,
  getTagsAction,
  createTagAction,
  updateTagAction,
  deleteTagAction,
  getTagCandidatesAction,
  promoteTagCandidateAction,
}: AdminTagsClientProps) {
  const {
    tags,
    searchInput,
    setSearchInput,
    activeSearch,
    sortValue,
    handleSortChange,
    currentPage,
    totalPages,
    totalItems,
    isLoading,
    handlePageChange,
    refreshTags,
  } = useAdminTagsState({
    initialTags,
    initialPagination,
    getTagsAction,
  })

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<TagData | null>(null)
  const [deletingTag, setDeletingTag] = useState<TagData | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = useCallback(async () => {
    if (!deletingTag) return

    try {
      setIsDeleting(true)
      const response = await deleteTagAction(deletingTag.id)

      if (response.success) {
        toast.success(response.data?.message || "标签已删除")
        setDeletingTag(null)
        await refreshTags()
      } else {
        toast.error(response.error?.message || "删除标签失败")
      }
    } catch (error) {
      toast.error("删除标签失败")
    } finally {
      setIsDeleting(false)
    }
  }, [deleteTagAction, deletingTag, refreshTags])

  const handleMutationSuccess = useCallback(() => {
    setIsCreateDialogOpen(false)
    setEditingTag(null)
    void refreshTags()
  }, [refreshTags])

  const openCreateDialog = useCallback(() => setIsCreateDialogOpen(true), [])
  const openEditDialog = useCallback((tag: TagData) => setEditingTag(tag), [])
  const openDeleteDialog = useCallback((tag: TagData) => setDeletingTag(tag), [])

  return (
    <>
      <div className="space-y-8">
        <TagQueryPanel
          totalItems={totalItems}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          sortValue={sortValue}
          onSortChange={handleSortChange}
          onCreateClick={openCreateDialog}
        />

        <TagTableView
          tags={tags}
          isLoading={isLoading}
          searchTerm={activeSearch}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          onEdit={openEditDialog}
          onDelete={openDeleteDialog}
          onCreateClick={openCreateDialog}
        />

        <TagCandidateReview
          initialCandidates={initialCandidates}
          initialPagination={initialCandidatePagination}
          initialError={initialCandidateError}
          getCandidatesAction={getTagCandidatesAction}
          promoteCandidateAction={promoteTagCandidateAction}
          onPromoteSuccess={() => {
            void refreshTags()
          }}
        />
      </div>

      <TagDialog
        open={isCreateDialogOpen || !!editingTag}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false)
            setEditingTag(null)
          }
        }}
        tag={editingTag || undefined}
        onSuccess={handleMutationSuccess}
        createTagAction={createTagAction}
        updateTagAction={updateTagAction}
      />

      <TagDeleteDialog
        open={!!deletingTag}
        tag={deletingTag}
        isDeleting={isDeleting}
        onConfirm={handleDelete}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingTag(null)
          }
        }}
      />
    </>
  )
}
