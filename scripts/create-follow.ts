import { prisma } from "./lib/prisma"

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "user@example.com" },
    select: { id: true },
  })
  const actor = await prisma.user.findUnique({
    where: { email: "admin@example.com" },
    select: { id: true },
  })
  console.log({ user, actor })
  if (!user || !actor) throw new Error("missing user/admin")
  const n = await prisma.notification.create({
    data: {
      recipientId: user.id,
      actorId: actor.id,
      type: "FOLLOW",
      followerId: actor.id,
    },
  })
  console.log("created", n.id)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
