/**
 * 关注列表测试数据种子脚本
 *
 * 用途：生成足够的测试数据来验证关注列表的无限滚动和分页逻辑
 *
 * 运行方式：
 * pnpm tsx scripts/seed-follow-test-data.ts
 */

import { PrismaClient, Role, UserStatus } from "@/lib/generated/prisma"
import bcrypt from "bcrypt"
import { createClient } from "@supabase/supabase-js"

const prisma = new PrismaClient()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "缺少 Supabase 服务端配置。请在环境变量中设置 NEXT_PUBLIC_SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY"
  )
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function upsertSupabaseAuthUser(params: {
  email: string
  password: string
  userMetadata?: Record<string, any>
}) {
  const { email, password, userMetadata } = params
  const normalizedEmail = email.toLowerCase()

  const { data: listedUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })

  if (listError) {
    throw new Error(`查询 Supabase 用户失败: ${listError.message}`)
  }

  const existingUser = listedUsers.users.find(
    (user) => user.email?.toLowerCase() === normalizedEmail
  )

  if (existingUser) {
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    })

    if (updateError) {
      throw new Error(`更新 Supabase 用户失败: ${updateError.message}`)
    }

    return existingUser.id
  }

  const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: userMetadata,
  })

  if (createError || !createdUser?.user) {
    throw new Error(`创建 Supabase 用户失败: ${createError?.message || "未知错误"}`)
  }

  return createdUser.user.id
}

async function main() {
  console.log("🌱 开始生成关注列表测试数据...")

  // 创建测试主用户（用于测试关注列表）
  console.log("👤 创建测试主用户...")
  const testUserAuthId = await upsertSupabaseAuthUser({
    email: "testuser@example.com",
    password: "test123456",
    userMetadata: {
      name: "测试主用户",
      full_name: "测试主用户",
    },
  })
  const testUserPassword = await bcrypt.hash("test123456", 10)
  const testUser = await prisma.user.upsert({
    where: { id: testUserAuthId },
    update: {
      email: "testuser@example.com",
      name: "测试主用户",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=testuser",
      bio: "用于测试关注列表分页的主用户",
      role: Role.USER,
      status: UserStatus.ACTIVE,
      passwordHash: testUserPassword,
      lastLoginAt: new Date(),
    },
    create: {
      id: testUserAuthId,
      email: "testuser@example.com",
      name: "测试主用户",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=testuser",
      bio: "用于测试关注列表分页的主用户",
      role: Role.USER,
      status: UserStatus.ACTIVE,
      passwordHash: testUserPassword,
      lastLoginAt: new Date(),
    },
  })
  console.log(`✅ 创建测试主用户: ${testUser.email}`)

  // 创建 30 个测试用户（超过默认 pageSize=20）
  console.log("👥 创建 30 个测试用户...")
  const followerUsers = []
  for (let i = 1; i <= 30; i++) {
    const email = `follower${i}@example.com`
    const name = `关注者${i}`
    const password = "follower123456"

    const authId = await upsertSupabaseAuthUser({
      email,
      password,
      userMetadata: {
        name,
        full_name: name,
      },
    })

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.upsert({
      where: { id: authId },
      update: {
        email,
        name,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=follower${i}`,
        bio: `我是第 ${i} 个关注者`,
        role: Role.USER,
        status: UserStatus.ACTIVE,
        passwordHash,
        lastLoginAt: new Date(),
      },
      create: {
        id: authId,
        email,
        name,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=follower${i}`,
        bio: `我是第 ${i} 个关注者`,
        role: Role.USER,
        status: UserStatus.ACTIVE,
        passwordHash,
        lastLoginAt: new Date(),
      },
    })

    followerUsers.push(user)
    if (i % 10 === 0) {
      console.log(`  ✅ 已创建 ${i}/30 个用户`)
    }
  }
  console.log(`✅ 完成创建 30 个测试用户`)

  // 创建关注关系：所有 30 个用户都关注测试主用户
  console.log("👥 创建关注关系...")
  for (let i = 0; i < followerUsers.length; i++) {
    await prisma.follow.upsert({
      where: {
        followerId_followingId: {
          followerId: followerUsers[i].id,
          followingId: testUser.id,
        },
      },
      update: {},
      create: {
        followerId: followerUsers[i].id,
        followingId: testUser.id,
      },
    })

    if ((i + 1) % 10 === 0) {
      console.log(`  ✅ 已创建 ${i + 1}/30 个关注关系`)
    }
  }
  console.log(`✅ 完成创建 30 个关注关系`)

  // 创建反向关注关系：测试主用户关注前 25 个用户
  console.log("👥 创建反向关注关系（测试互关）...")
  for (let i = 0; i < 25; i++) {
    await prisma.follow.upsert({
      where: {
        followerId_followingId: {
          followerId: testUser.id,
          followingId: followerUsers[i].id,
        },
      },
      update: {},
      create: {
        followerId: testUser.id,
        followingId: followerUsers[i].id,
      },
    })

    if ((i + 1) % 10 === 0) {
      console.log(`  ✅ 已创建 ${i + 1}/25 个反向关注关系`)
    }
  }
  console.log(`✅ 完成创建 25 个反向关注关系`)

  console.log("\n✨ 关注列表测试数据生成完成！")
  console.log("📊 数据统计:")
  console.log(`  - 测试主用户: 1 个 (testuser@example.com)`)
  console.log(`  - 关注者用户: 30 个 (follower1-30@example.com)`)
  console.log(`  - 粉丝关系: 30 个 (所有用户关注测试主用户)`)
  console.log(`  - 关注关系: 25 个 (测试主用户关注前 25 个用户)`)
  console.log(`  - 互关关系: 25 个 (前 25 个用户与测试主用户互关)`)

  console.log("\n🔑 测试账号:")
  console.log("  测试主用户: testuser@example.com / test123456")
  console.log("  关注者用户: follower1@example.com / follower123456")
  console.log("  关注者用户: follower2@example.com / follower123456")
  console.log("  ... (follower1-30)")

  console.log("\n📝 验证建议:")
  console.log("  1. 登录 testuser@example.com")
  console.log("  2. 访问 /settings 页面的关注管理")
  console.log("  3. 查看粉丝列表（应有 30 个，分 2 页）")
  console.log("  4. 查看关注列表（应有 25 个，分 2 页）")
  console.log("  5. 观察网络请求中的 cursor 和 includeTotal 参数")
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error("❌ 测试数据生成失败:", e)
    await prisma.$disconnect()
    process.exit(1)
  })
