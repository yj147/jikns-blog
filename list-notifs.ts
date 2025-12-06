import { prisma } from './lib/prisma'

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'user@example.com' }, select: { id: true, email: true } })
  console.log('user', user)
  if (!user) return
  const notifs = await prisma.notification.findMany({
    where: { recipientId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, type: true, readAt: true, createdAt: true, actorId: true, followerId: true, postId: true, activityId: true }
  })
  console.log('notifications', notifs)
  await prisma.$disconnect()
}
main().catch((e)=>{console.error(e); process.exit(1)})
