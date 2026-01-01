import { readFile } from "node:fs/promises"
import { join } from "node:path"

export const runtime = "nodejs"

const FAVICON_PATH = join(process.cwd(), "public", "placeholder-logo.png")

export async function GET() {
  const body = new Uint8Array(await readFile(FAVICON_PATH))

  return new Response(body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  })
}
