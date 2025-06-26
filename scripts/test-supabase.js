#!/usr/bin/env node

/**
 * Supabase 连接测试脚本
 * 用于验证 Supabase 配置是否正确
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

// 颜色输出函数
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
}

async function testSupabaseConnection() {
  console.log(colors.cyan('🧪 开始测试 Supabase 连接...\n'))

  // 检查环境变量
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.log(colors.red('❌ 错误：缺少必要的环境变量'))
    console.log(colors.yellow('请确保在 .env.local 文件中设置了以下变量：'))
    console.log('  - NEXT_PUBLIC_SUPABASE_URL')
    console.log('  - NEXT_PUBLIC_SUPABASE_ANON_KEY')
    process.exit(1)
  }

  console.log(colors.blue('📋 环境变量检查：'))
  console.log(`  Supabase URL: ${colors.green('✓')} ${supabaseUrl}`)
  console.log(`  Anon Key: ${colors.green('✓')} ${supabaseAnonKey.substring(0, 20)}...`)
  console.log()

  try {
    // 创建 Supabase 客户端
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    console.log(colors.green('✅ Supabase 客户端创建成功'))

    // 测试数据库连接
    console.log(colors.blue('🔍 测试数据库连接...'))

    // 检查表是否存在
    const { data: tables, error: tablesError } = await supabase
      .from('comments')
      .select('count', { count: 'exact', head: true })

    if (tablesError) {
      console.log(colors.red('❌ 数据库连接失败：'))
      console.log(colors.red(`   错误信息: ${tablesError.message}`))
      console.log(colors.yellow('💡 可能的解决方案：'))
      console.log('   1. 检查 Supabase URL 和 API Key 是否正确')
      console.log('   2. 确保已运行数据库初始化脚本')
      console.log('   3. 检查 Supabase 项目是否已启用')
      return false
    }

    console.log(colors.green('✅ 数据库连接成功'))
    console.log(`   评论表记录数: ${tables || 0}`)

    // 测试插入评论
    console.log(colors.blue('🧪 测试插入评论...'))

    const testComment = {
      post_slug: 'test-connection',
      author_name: '测试用户',
      author_email: 'test@example.com',
      content: '这是一条测试评论，用于验证数据库连接。',
      is_anonymous: true,
      is_approved: true,
    }

    const { data: insertData, error: insertError } = await supabase
      .from('comments')
      .insert(testComment)
      .select()
      .single()

    if (insertError) {
      console.log(colors.red('❌ 插入测试评论失败：'))
      console.log(colors.red(`   错误信息: ${insertError.message}`))
      return false
    }

    console.log(colors.green('✅ 测试评论插入成功'))
    console.log(`   评论ID: ${insertData.id}`)

    // 测试查询评论
    console.log(colors.blue('🔍 测试查询评论...'))

    const { data: queryData, error: queryError } = await supabase
      .from('comments')
      .select('*')
      .eq('post_slug', 'test-connection')
      .eq('is_approved', true)

    if (queryError) {
      console.log(colors.red('❌ 查询评论失败：'))
      console.log(colors.red(`   错误信息: ${queryError.message}`))
      return false
    }

    console.log(colors.green('✅ 评论查询成功'))
    console.log(`   查询到 ${queryData.length} 条评论`)

    // 清理测试数据
    console.log(colors.blue('🧹 清理测试数据...'))

    const { error: deleteError } = await supabase
      .from('comments')
      .delete()
      .eq('post_slug', 'test-connection')

    if (deleteError) {
      console.log(colors.yellow('⚠️  清理测试数据失败（不影响功能）：'))
      console.log(colors.yellow(`   错误信息: ${deleteError.message}`))
    } else {
      console.log(colors.green('✅ 测试数据清理完成'))
    }

    // 测试认证功能
    console.log(colors.blue('🔐 测试认证功能...'))

    const { data: authData, error: authError } = await supabase.auth.getSession()

    if (authError) {
      console.log(colors.yellow('⚠️  认证功能测试失败（不影响匿名评论）：'))
      console.log(colors.yellow(`   错误信息: ${authError.message}`))
    } else {
      console.log(colors.green('✅ 认证功能正常'))
      console.log(`   当前会话状态: ${authData.session ? '已登录' : '未登录'}`)
    }

    return true
  } catch (error) {
    console.log(colors.red('❌ 测试过程中发生错误：'))
    console.log(colors.red(`   ${error.message}`))
    return false
  }
}

async function main() {
  const success = await testSupabaseConnection()

  console.log('\n' + '='.repeat(50))

  if (success) {
    console.log(colors.green('🎉 Supabase 连接测试通过！'))
    console.log(colors.cyan('💡 接下来你可以：'))
    console.log('   1. 启动开发服务器：npm run dev')
    console.log('   2. 访问博客页面测试评论功能')
    console.log('   3. 在 Supabase 控制台查看数据')
    process.exit(0)
  } else {
    console.log(colors.red('💥 Supabase 连接测试失败'))
    console.log(colors.yellow('🔧 请检查配置后重新运行测试'))
    process.exit(1)
  }
}

// 运行测试
main().catch((error) => {
  console.error(colors.red('💥 测试脚本执行失败：'), error)
  process.exit(1)
})
