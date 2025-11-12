import { NextRequest } from "next/server"
import { handleFollowListRequest } from "../follow-list-handler"

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  return handleFollowListRequest({ req, params: { userId }, type: "followers" })
}
