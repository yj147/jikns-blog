import Link from "next/link"
import {
  createTag,
  deleteTag,
  getTags,
  getTagCandidates,
  promoteTagCandidate,
  type GetTagsOptions,
  type GetTagCandidatesOptions,
  updateTag,
} from "@/lib/actions/tags"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AdminTagsClient } from "./admin-tags-client"

const DEFAULT_QUERY: Partial<GetTagsOptions> = {
  page: 1,
  limit: 20,
  orderBy: "postsCount",
  order: "desc",
}

const DEFAULT_CANDIDATE_QUERY: Partial<GetTagCandidatesOptions> = {
  page: 1,
  limit: 20,
  orderBy: "occurrences",
  order: "desc",
}

function renderLoadError(title: string, description: string) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-xl">
        <CardContent className="space-y-4 py-10 text-center">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
          <Button variant="outline" asChild>
            <Link href="/admin/tags">刷新页面</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function AdminTagsPage() {
  const [initialResponse, candidateResponse] = await Promise.all([
    getTags(DEFAULT_QUERY, { skipRateLimit: true }),
    getTagCandidates(DEFAULT_CANDIDATE_QUERY),
  ])

  if (!initialResponse.success || !initialResponse.data) {
    return renderLoadError(
      "无法加载标签数据",
      "请刷新页面或稍后再试。如果问题持续存在，请联系站点管理员。"
    )
  }

  const { tags, pagination } = initialResponse.data
  const initialCandidates = candidateResponse.success
    ? (candidateResponse.data?.candidates ?? [])
    : []
  const initialCandidatePagination =
    candidateResponse.success && candidateResponse.data
      ? candidateResponse.data.pagination
      : {
          page: DEFAULT_CANDIDATE_QUERY.page ?? 1,
          limit: DEFAULT_CANDIDATE_QUERY.limit ?? 20,
          total: 0,
          totalPages: 1,
          hasMore: false,
        }
  const candidateError = candidateResponse.success
    ? null
    : {
        code: candidateResponse.error?.code ?? "UNKNOWN_ERROR",
        message: candidateResponse.error?.message ?? "加载候选标签失败",
      }

  return (
    <AdminTagsClient
      initialTags={tags}
      initialPagination={pagination}
      initialCandidates={initialCandidates}
      initialCandidatePagination={initialCandidatePagination}
      initialCandidateError={candidateError}
      getTagsAction={getTags}
      createTagAction={createTag}
      updateTagAction={updateTag}
      deleteTagAction={deleteTag}
      getTagCandidatesAction={getTagCandidates}
      promoteTagCandidateAction={promoteTagCandidate}
    />
  )
}
