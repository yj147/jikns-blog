import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { withApiResponseMetrics } from "@/lib/api/response-wrapper"

async function handleGet(request: NextRequest) {
  // 🔒 安全检查：仅开发环境可访问调试端点
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 404 }
    )
  }

  try {
    console.log('🔍 [DEBUG] 开始测试 getCurrentUser...')

    const startTime = Date.now()
    const user = await getCurrentUser()
    const duration = Date.now() - startTime

    console.log('✅ [DEBUG] getCurrentUser 完成，耗时:', duration, 'ms')
    console.log('📊 [DEBUG] 用户信息:', user ? {
      id: user.id,
      email: user.email,
      role: user.role
    } : 'null')

    return NextResponse.json({
      success: true,
      user: user ? {
        id: user.id,
        email: user.email,
        role: user.role
      } : null,
      duration,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('❌ [DEBUG] getCurrentUser 失败:', error.message)
    console.error('📝 [DEBUG] 错误堆栈:', error.stack)
    console.error('🔧 [DEBUG] 错误详情:', {
      name: error.name,
      message: error.message,
      code: error.code,
      cause: error.cause
    })

    return NextResponse.json({
      success: false,
      error: {
        message: error.message,
        name: error.name,
        code: error.code,
        stack: error.stack,
        cause: error.cause
      }
    }, { status: 500 })
  }
}

export const GET = withApiResponseMetrics(handleGet)
