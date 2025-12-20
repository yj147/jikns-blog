import { prisma } from "../lib/prisma"

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      location: true,
      phone: true,
      privacySettings: true,
    },
    take: 5,
  })

  console.log("=== 用户隐私设置检查 ===")
  for (const user of users) {
    console.log(`\n用户: ${user.name || user.email}`)
    console.log(`  location: ${user.location}`)
    console.log(`  phone: ${user.phone}`)
    console.log(`  privacySettings (raw): ${JSON.stringify(user.privacySettings)}`)
    console.log(`  privacySettings type: ${typeof user.privacySettings}`)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
