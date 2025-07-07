// GitHub头像调试脚本
// 用于测试和调试GitHub OAuth头像获取问题

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ 缺少Supabase配置')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function debugGitHubAvatars() {
  console.log('🔍 开始调试GitHub头像问题...\n')

  try {
    // 1. 检查users表中的GitHub用户
    console.log('📊 检查users表中的GitHub用户...')
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, display_name, avatar_url')
      .not('avatar_url', 'is', null)

    if (usersError) {
      console.error('❌ 查询用户失败:', usersError)
      return
    }

    console.log(`✅ 找到 ${users.length} 个有头像的用户`)

    // 2. 分析头像URL
    const githubAvatars = users.filter(
      (user) => user.avatar_url && user.avatar_url.includes('github')
    )

    console.log(`\n🔗 GitHub头像URL分析 (${githubAvatars.length}个):`)
    githubAvatars.forEach((user, index) => {
      console.log(`${index + 1}. ${user.display_name || user.email}`)
      console.log(`   URL: ${user.avatar_url}`)

      // 分析URL结构
      try {
        const url = new URL(user.avatar_url)
        console.log(`   域名: ${url.hostname}`)
        console.log(`   路径: ${url.pathname}`)
        console.log(`   参数: ${url.search}`)
      } catch (e) {
        console.log(`   ❌ 无效URL格式`)
      }
      console.log('')
    })

    // 3. 测试头像URL可访问性
    console.log('🌐 测试头像URL可访问性...')
    for (const user of githubAvatars.slice(0, 3)) {
      // 只测试前3个
      try {
        console.log(`测试: ${user.avatar_url}`)
        const response = await fetch(user.avatar_url, { method: 'HEAD' })
        console.log(`✅ 状态: ${response.status} ${response.statusText}`)
        console.log(`   Content-Type: ${response.headers.get('content-type')}`)
        console.log(`   Content-Length: ${response.headers.get('content-length')}`)
      } catch (error) {
        console.log(`❌ 访问失败: ${error.message}`)
      }
      console.log('')
    }

    // 4. 检查常见的GitHub头像域名
    console.log('🔍 检查常见的GitHub头像域名...')
    const commonDomains = [
      'avatars.githubusercontent.com',
      'avatars0.githubusercontent.com',
      'avatars1.githubusercontent.com',
      'avatars2.githubusercontent.com',
      'avatars3.githubusercontent.com',
      'github.com',
    ]

    const usedDomains = new Set()
    githubAvatars.forEach((user) => {
      try {
        const url = new URL(user.avatar_url)
        usedDomains.add(url.hostname)
      } catch (e) {
        console.error(`   ❌ 无效URL格式或解析错误: ${e.message}`)
      }
    })

    console.log('使用的域名:')
    usedDomains.forEach((domain) => {
      console.log(`✅ ${domain}`)
    })

    console.log('\n未使用但可能需要的域名:')
    commonDomains.forEach((domain) => {
      if (!usedDomains.has(domain)) {
        console.log(`⚠️  ${domain}`)
      }
    })

    // 5. 生成修复建议
    console.log('\n💡 修复建议:')
    console.log('1. 确保next.config.js中包含所有GitHub头像域名')
    console.log('2. 重启开发服务器以应用配置更改')
    console.log('3. 清除浏览器缓存')
    console.log('4. 检查用户头像URL是否有效')
  } catch (error) {
    console.error('❌ 调试过程中发生错误:', error)
  }
}

// 运行调试
debugGitHubAvatars()
  .then(() => {
    console.log('\n🎯 调试完成!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 调试失败:', error)
    process.exit(1)
  })
