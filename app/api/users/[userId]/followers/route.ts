import { NextRequest } from "next/server"
import { handleFollowListRequest } from "../follow-list-handler"
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

async function handleGet(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  return handleFollowListRequest({ req, params: { userId }, type: "followers" })
}

export const GET = withApiResponseMetrics(handleGet)
