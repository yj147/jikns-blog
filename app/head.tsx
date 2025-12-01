import { readFileSync } from "fs"
import { join } from "path"

const criticalCSS = readFileSync(join(process.cwd(), "app/critical.css"), "utf8")

export default function Head() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: criticalCSS }} />
    </>
  )
}
