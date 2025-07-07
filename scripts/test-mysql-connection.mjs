/**
 * MySQL 连接测试脚本
 * 用于测试数据库连接和基本操作
 */

import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

// 数据库配置
const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'blog_comments',
}

async function testConnection() {
  console.log('🔗 测试 MySQL 数据库连接...')
  console.log('配置信息:', {
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    database: dbConfig.database,
    password: '***', // 隐藏密码
  })

  let connection

  try {
    // 创建连接
    connection = await mysql.createConnection(dbConfig)
    console.log('✅ 数据库连接成功!')

    // 测试查询
    const [rows] = await connection.execute('SELECT 1 as test')
    console.log('✅ 查询测试成功:', rows[0])

    // 检查表是否存在
    const [tables] = await connection.execute("SHOW TABLES LIKE 'comments'")

    if (tables.length > 0) {
      console.log('✅ comments 表已存在')

      // 获取表结构
      const [columns] = await connection.execute('DESCRIBE comments')
      console.log('📋 表结构:')
      columns.forEach((col) => {
        console.log(
          `  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `(${col.Key})` : ''}`
        )
      })

      // 获取评论数量
      const [countResult] = await connection.execute('SELECT COUNT(*) as count FROM comments')
      console.log(`📊 当前评论数量: ${countResult[0].count}`)
    } else {
      console.log('⚠️  comments 表不存在，请执行 database/init.sql 初始化数据库')
    }
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message)

    if (error.code === 'ECONNREFUSED') {
      console.log('💡 建议检查:')
      console.log('  1. MySQL 服务是否启动')
      console.log('  2. 主机地址和端口是否正确')
      console.log('  3. 防火墙设置')
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('💡 建议检查:')
      console.log('  1. 用户名和密码是否正确')
      console.log('  2. 用户是否有访问权限')
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('💡 建议检查:')
      console.log('  1. 数据库名称是否正确')
      console.log('  2. 数据库是否已创建')
    }
  } finally {
    if (connection) {
      await connection.end()
      console.log('🔌 数据库连接已关闭')
    }
  }
}

async function testEnvironmentVariables() {
  console.log('\n🔧 检查环境变量...')

  const requiredVars = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE']
  const missingVars = []

  requiredVars.forEach((varName) => {
    if (!process.env[varName]) {
      missingVars.push(varName)
    }
  })

  if (missingVars.length > 0) {
    console.log('❌ 缺少以下环境变量:')
    missingVars.forEach((varName) => {
      console.log(`  - ${varName}`)
    })
    console.log('\n💡 请在 .env.local 文件中设置这些变量')
    return false
  } else {
    console.log('✅ 所有必需的环境变量都已设置')
    return true
  }
}

async function main() {
  console.log('🚀 MySQL 数据库连接测试开始...\n')

  // 检查环境变量
  const envOk = await testEnvironmentVariables()

  if (envOk) {
    // 测试数据库连接
    await testConnection()
  }

  console.log('\n🏁 测试完成!')
}

// 运行测试
main().catch(console.error)

export { testConnection, testEnvironmentVariables }
