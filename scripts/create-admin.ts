/**
 * 创建管理员账户脚本
 * 用于快速创建或重置管理员账户
 */

import { PrismaClient, Role, UserStatus } from "@/lib/generated/prisma"
import bcrypt from "bcrypt"
import { createClient } from "@supabase/supabase-js"

const prisma = new PrismaClient()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌ 缺少 Supabase 配置")
  console.log("请确保 .env.local 中设置了以下环境变量:")
  console.log("  - NEXT_PUBLIC_SUPABASE_URL")
  console.log("  - SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function createAdmin() {
  console.log("🔧 创建管理员账户...")
  console.log("")

  // 管理员信息
  const adminEmail = "admin@example.com"
  const adminPassword = "admin123456"
  const adminName = "系统管理员"

  try {
    // 1. 在 Supabase Auth 中创建或更新用户
    console.log("📝 步骤 1: 在 Supabase Auth 中创建用户...")

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users.find(
      (user) => user.email?.toLowerCase() === adminEmail.toLowerCase()
    )

    let authUserId: string

    if (existingUser) {
      console.log(`   ℹ️  用户已存在: ${existingUser.email}`)
      console.log(`   🔄 更新密码...`)

      const { error } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password: adminPassword,
        email_confirm: true,
        user_metadata: {
          name: adminName,
          full_name: adminName,
        },
      })

      if (error) {
        throw new Error(`更新用户失败: ${error.message}`)
      }

      authUserId = existingUser.id
      console.log(`   ✅ 密码已更新`)
    } else {
      console.log(`   🆕 创建新用户...`)

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: {
          name: adminName,
          full_name: adminName,
        },
      })

      if (error || !data?.user) {
        throw new Error(`创建用户失败: ${error?.message || "未知错误"}`)
      }

      authUserId = data.user.id
      console.log(`   ✅ 用户已创建`)
    }

    // 2. 在数据库中创建或更新用户记录
    console.log("")
    console.log("📝 步骤 2: 在数据库中创建用户记录...")

    const hashedPassword = await bcrypt.hash(adminPassword, 10)

    const user = await prisma.user.upsert({
      where: { id: authUserId },
      update: {
        email: adminEmail,
        name: adminName,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
        passwordHash: hashedPassword,
        avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
        bio: "博客系统管理员，负责内容发布和系统维护。",
        socialLinks: {
          github: "https://github.com",
          website: "https://example.com",
        },
      },
      create: {
        id: authUserId,
        email: adminEmail,
        name: adminName,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
        passwordHash: hashedPassword,
        avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
        bio: "博客系统管理员，负责内容发布和系统维护。",
        socialLinks: {
          github: "https://github.com",
          website: "https://example.com",
        },
      },
    })

    console.log(`   ✅ 数据库记录已创建`)

    // 3. 显示结果
    console.log("")
    console.log("=".repeat(60))
    console.log("✅ 管理员账户创建成功！")
    console.log("=".repeat(60))
    console.log("")
    console.log("📋 账户信息:")
    console.log(`   用户 ID:  ${user.id}`)
    console.log(`   邮箱:     ${user.email}`)
    console.log(`   密码:     ${adminPassword}`)
    console.log(`   角色:     ${user.role}`)
    console.log(`   状态:     ${user.status}`)
    console.log("")
    console.log("🔗 登录地址:")
    console.log(`   http://localhost:3999/login`)
    console.log("")
    console.log("⚠️  重要提示:")
    console.log("   1. 请立即登录并修改默认密码")
    console.log("   2. 不要在生产环境使用默认密码")
    console.log("   3. 建议启用双因素认证")
    console.log("")
  } catch (error) {
    console.error("")
    console.error("❌ 创建管理员账户失败:")
    console.error(error)
    console.error("")
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// 运行脚本
createAdmin()
  .then(() => {
    console.log("🎉 脚本执行完成")
    process.exit(0)
  })
  .catch((error) => {
    console.error("💥 脚本执行失败:", error)
    process.exit(1)
  })
