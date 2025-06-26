/**
 * Vercel Postgres 连接测试脚本
 * 用于测试数据库连接和基本操作
 */

require('dotenv').config({ path: '.env.local' })

async function testConnection() {
  console.log('🔗 测试 Vercel Postgres 数据库连接...')

  // 检查环境变量
  const requiredVars = ['POSTGRES_URL']
  const missingVars = requiredVars.filter((varName) => !process.env[varName])

  if (missingVars.length > 0) {
    console.log('❌ 缺少以下环境变量:')
    missingVars.forEach((varName) => {
      console.log(`  - ${varName}`)
    })
    console.log('\n💡 请确保：')
    console.log('  1. 已在 Vercel 控制台创建 Postgres 数据库')
    console.log('  2. 已将数据库连接到项目')
    console.log('  3. 已运行 "vercel env pull .env.local"')
    return
  }

  try {
    // 动态导入 @vercel/postgres
    const { sql } = await import('@vercel/postgres')

    console.log('✅ Vercel Postgres 模块加载成功!')

    // 测试基本查询
    const result = await sql`SELECT 1 as test, NOW() as current_time`
    console.log('✅ 数据库连接成功!')
    console.log('📊 测试查询结果:', result[0])

    // 检查表是否存在
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'comments'
    `

    if (tables.length > 0) {
      console.log('✅ comments 表已存在')

      // 获取表结构
      const columns = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'comments'
        ORDER BY ordinal_position
      `

      console.log('📋 表结构:')
      columns.forEach((col) => {
        console.log(
          `  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`
        )
      })

      // 获取评论数量
      const countResult = await sql`SELECT COUNT(*) as count FROM comments`
      console.log(`📊 当前评论数量: ${countResult[0].count}`)

      // 检查索引
      const indexes = await sql`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'comments'
      `

      console.log('🔍 表索引:')
      indexes.forEach((idx) => {
        console.log(`  - ${idx.indexname}`)
      })
    } else {
      console.log('⚠️  comments 表不存在，请执行 database/init.sql 初始化数据库')
      console.log('💡 初始化方法:')
      console.log('  1. 在 Vercel 控制台的数据库 Query 页面执行 SQL')
      console.log('  2. 或使用 psql $POSTGRES_URL < database/init.sql')
    }

    // 测试插入和查询（如果表存在）
    if (tables.length > 0) {
      console.log('\n🧪 测试插入和查询操作...')

      try {
        // 插入测试评论
        const insertResult = await sql`
          INSERT INTO comments (post_slug, author_name, author_email, content, is_approved)
          VALUES ('test-connection', 'Test User', 'test@example.com', 'This is a test comment from connection script.', true)
          RETURNING id, created_at
        `

        console.log('✅ 测试评论插入成功:', insertResult[0].id)

        // 查询测试评论
        const selectResult = await sql`
          SELECT * FROM comments 
          WHERE post_slug = 'test-connection' 
          ORDER BY created_at DESC 
          LIMIT 1
        `

        console.log('✅ 测试评论查询成功:', selectResult[0].author_name)

        // 删除测试评论
        await sql`
          DELETE FROM comments 
          WHERE post_slug = 'test-connection'
        `

        console.log('✅ 测试评论清理完成')
      } catch (testError) {
        console.log('⚠️  测试操作失败:', testError.message)
      }
    }
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message)

    if (error.message.includes('ENOTFOUND')) {
      console.log('💡 建议检查:')
      console.log('  1. 网络连接是否正常')
      console.log('  2. POSTGRES_URL 是否正确')
      console.log('  3. Vercel 数据库是否正常运行')
    } else if (error.message.includes('authentication')) {
      console.log('💡 建议检查:')
      console.log('  1. 数据库用户名和密码是否正确')
      console.log('  2. 是否有访问权限')
      console.log('  3. 重新运行 "vercel env pull .env.local"')
    } else if (error.message.includes('does not exist')) {
      console.log('💡 建议检查:')
      console.log('  1. 数据库是否已创建')
      console.log('  2. 表是否已初始化')
      console.log('  3. 执行 database/init.sql 初始化脚本')
    }
  }
}

async function testEnvironmentVariables() {
  console.log('\n🔧 检查环境变量...')

  const vercelVars = [
    'POSTGRES_URL',
    'POSTGRES_PRISMA_URL',
    'POSTGRES_URL_NON_POOLING',
    'POSTGRES_USER',
    'POSTGRES_HOST',
    'POSTGRES_PASSWORD',
    'POSTGRES_DATABASE',
  ]

  const presentVars = []
  const missingVars = []

  vercelVars.forEach((varName) => {
    if (process.env[varName]) {
      presentVars.push(varName)
    } else {
      missingVars.push(varName)
    }
  })

  console.log('✅ 已设置的环境变量:')
  presentVars.forEach((varName) => {
    const value = process.env[varName]
    const maskedValue =
      varName.includes('PASSWORD') || varName.includes('URL')
        ? value.substring(0, 20) + '...'
        : value
    console.log(`  - ${varName}: ${maskedValue}`)
  })

  if (missingVars.length > 0) {
    console.log('\n⚠️  缺少的环境变量:')
    missingVars.forEach((varName) => {
      console.log(`  - ${varName}`)
    })
    console.log('\n💡 这些变量是可选的，Vercel 会自动管理')
  }

  return presentVars.length > 0
}

async function main() {
  console.log('🚀 Vercel Postgres 数据库连接测试开始...\n')

  // 检查环境变量
  const envOk = await testEnvironmentVariables()

  if (envOk) {
    // 测试数据库连接
    await testConnection()
  }

  console.log('\n🏁 测试完成!')
  console.log('\n📚 更多信息请参考: docs/VERCEL_POSTGRES_SETUP.md')
}

// 运行测试
if (require.main === module) {
  main().catch(console.error)
}

module.exports = { testConnection, testEnvironmentVariables }
