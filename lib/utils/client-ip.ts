/**
 * 客户端 IP 解析工具（统一入口）
 * - 优先使用平台提供的 request.ip
 * - 仅在受信代理开启时读取 X-Forwarded-For / X-Real-IP
 */

import { NextRequest } from "next/server"
import {
  getClientIp,
  getClientIpFromHeaders,
  getClientIpOrNull,
  getClientIpOrNullFromHeaders,
} from "@/lib/api/get-client-ip"

type HeaderGetter = Pick<Headers, "get">

export function getClientIP(request: NextRequest): string {
  return getClientIp(request)
}

export function getClientIPOrNull(request: NextRequest): string | null {
  return getClientIpOrNull(request)
}

export function getClientIPFromHeaders(headers: HeaderGetter): string {
  return getClientIpFromHeaders(headers)
}

export function getClientIPOrNullFromHeaders(headers: HeaderGetter): string | null {
  return getClientIpOrNullFromHeaders(headers)
}
