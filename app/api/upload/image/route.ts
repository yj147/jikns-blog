import { uploadImage } from "@/lib/actions/upload"
import { logger } from "@/lib/utils/logger"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const result = await uploadImage(formData)

    if (result.success) {
      return NextResponse.json(result)
    } else {
      return NextResponse.json(result, { status: 400 })
    }
  } catch (error) {
    logger.error("图片上传接口异常", { module: "api/upload/image" }, error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "图片上传服务异常",
          timestamp: Date.now(),
        },
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "仅支持 POST 请求",
        timestamp: Date.now(),
      },
    },
    { status: 405 }
  )
}
