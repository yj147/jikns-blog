/**
 * MySQL 到 PostgreSQL 数据迁移脚本
 * 用于将现有的 MySQL 评论数据迁移到 Vercel Postgres
 */

import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function migrateData() {
  console.log('🔄 开始数据迁移：MySQL -> Vercel Postgres')

  // 检查环境变量
  const mysqlVars = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE']
  const postgresVars = ['POSTGRES_URL']

  const missingMysqlVars = mysqlVars.filter((v) => !process.env[v])
  const missingPostgresVars = postgresVars.filter((v) => !process.env[v])

  if (missingMysqlVars.length > 0) {
    console.log('❌ 缺少 MySQL 环境变量:', missingMysqlVars.join(', '))
    console.log('💡 请在 .env.local 中配置 MySQL 连接信息')
    return
  }

  if (missingPostgresVars.length > 0) {
    console.log('❌ 缺少 PostgreSQL 环境变量:', missingPostgresVars.join(', '))
    console.log('💡 请确保已设置 Vercel Postgres 并运行 "vercel env pull .env.local"')
    return
  }

  let mysqlConnection
  let postgresClient

  try {
    // 连接 MySQL
    console.log('🔗 连接到 MySQL 数据库...')
    mysqlConnection = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
    })
    console.log('✅ MySQL 连接成功')

    // 连接 PostgreSQL
    console.log('🔗 连接到 Vercel Postgres...')
    const { sql } = await import('@vercel/postgres')
    postgresClient = sql

    // 测试 PostgreSQL 连接
    await postgresClient`SELECT 1`
    console.log('✅ Vercel Postgres 连接成功')

    // 检查 MySQL 中的数据
    console.log('📊 检查 MySQL 数据...')
    const [mysqlComments] = await mysqlConnection.execute(
      'SELECT * FROM comments ORDER BY created_at'
    )

    console.log(`📈 找到 ${mysqlComments.length} 条评论记录`)

    if (mysqlComments.length === 0) {
      console.log('ℹ️  没有数据需要迁移')
      return
    }

    // 检查 PostgreSQL 表是否存在
    console.log('🔍 检查 PostgreSQL 表结构...')
    const tables = await postgresClient`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'comments'
    `

    if (tables.length === 0) {
      console.log('❌ PostgreSQL comments 表不存在')
      console.log('💡 请先执行 database/init.sql 初始化数据库')
      return
    }

    // 清空 PostgreSQL 表（可选）
    const shouldClear = process.argv.includes('--clear')
    if (shouldClear) {
      console.log('🗑️  清空 PostgreSQL 表...')
      await postgresClient`DELETE FROM comments`
      console.log('✅ 表已清空')
    }

    // 开始迁移数据
    console.log('🚀 开始迁移数据...')
    let successCount = 0
    let errorCount = 0

    for (const comment of mysqlComments) {
      try {
        // 转换数据格式
        const postgresComment = {
          id: comment.id,
          post_slug: comment.post_slug,
          author_name: comment.author_name,
          author_email: comment.author_email,
          author_website: comment.author_website || null,
          content: comment.content,
          avatar_url: comment.avatar_url || null,
          parent_id: comment.parent_id || null,
          is_approved: Boolean(comment.is_approved),
          created_at: comment.created_at,
          updated_at: comment.updated_at,
        }

        // 插入到 PostgreSQL
        await postgresClient`
          INSERT INTO comments (
            id, post_slug, author_name, author_email, author_website,
            content, avatar_url, parent_id, is_approved, created_at, updated_at
          ) VALUES (
            ${postgresComment.id}::uuid,
            ${postgresComment.post_slug},
            ${postgresComment.author_name},
            ${postgresComment.author_email},
            ${postgresComment.author_website},
            ${postgresComment.content},
            ${postgresComment.avatar_url},
            ${postgresComment.parent_id ? postgresComment.parent_id + '::uuid' : null},
            ${postgresComment.is_approved},
            ${postgresComment.created_at},
            ${postgresComment.updated_at}
          )
          ON CONFLICT (id) DO UPDATE SET
            post_slug = EXCLUDED.post_slug,
            author_name = EXCLUDED.author_name,
            author_email = EXCLUDED.author_email,
            author_website = EXCLUDED.author_website,
            content = EXCLUDED.content,
            avatar_url = EXCLUDED.avatar_url,
            parent_id = EXCLUDED.parent_id,
            is_approved = EXCLUDED.is_approved,
            updated_at = EXCLUDED.updated_at
        `

        successCount++
        if (successCount % 10 === 0) {
          console.log(`📈 已迁移 ${successCount}/${mysqlComments.length} 条记录`)
        }
      } catch (error) {
        console.error(`❌ 迁移评论 ${comment.id} 失败:`, error.message)
        errorCount++
      }
    }

    // 验证迁移结果
    console.log('🔍 验证迁移结果...')
    const postgresCount = await postgresClient`SELECT COUNT(*) as count FROM comments`

    console.log('\n📊 迁移完成统计:')
    console.log(`  - MySQL 原始记录: ${mysqlComments.length}`)
    console.log(`  - 成功迁移: ${successCount}`)
    console.log(`  - 失败记录: ${errorCount}`)
    console.log(`  - PostgreSQL 最终记录: ${postgresCount[0].count}`)

    if (successCount === mysqlComments.length) {
      console.log('✅ 数据迁移完全成功!')
    } else {
      console.log('⚠️  部分数据迁移失败，请检查错误日志')
    }

    // 更新序列（如果使用自增 ID）
    console.log('🔧 更新 PostgreSQL 序列...')
    try {
      await postgresClient`
        SELECT setval(pg_get_serial_sequence('comments', 'id'), 
               COALESCE((SELECT MAX(id::text::int) FROM comments WHERE id ~ '^[0-9]+$'), 1), 
               false)
      `
      console.log('✅ 序列更新成功')
    } catch (seqError) {
      console.log('ℹ️  序列更新跳过（使用 UUID）')
    }
  } catch (error) {
    console.error('❌ 迁移过程中发生错误:', error.message)
  } finally {
    // 关闭连接
    if (mysqlConnection) {
      await mysqlConnection.end()
      console.log('🔌 MySQL 连接已关闭')
    }
    console.log('🏁 迁移脚本执行完成')
  }
}

// 显示使用说明
function showUsage() {
  console.log('📚 MySQL 到 PostgreSQL 数据迁移脚本')
  console.log('')
  console.log('使用方法:')
  console.log('  node scripts/migrate-mysql-to-postgres.mjs [选项]')
  console.log('')
  console.log('选项:')
  console.log('  --clear    迁移前清空 PostgreSQL 表')
  console.log('  --help     显示此帮助信息')
  console.log('')
  console.log('前置条件:')
  console.log('  1. 在 .env.local 中配置 MySQL 连接信息')
  console.log('  2. 设置 Vercel Postgres 并运行 "vercel env pull .env.local"')
  console.log('  3. 确保 PostgreSQL 表已初始化（执行 database/init.sql）')
  console.log('')
  console.log('示例:')
  console.log('  node scripts/migrate-mysql-to-postgres.mjs')
  console.log('  node scripts/migrate-mysql-to-postgres.mjs --clear')
}

// 运行脚本
if (process.argv.includes('--help')) {
  showUsage()
} else {
  migrateData().catch(console.error)
}

export { migrateData }
