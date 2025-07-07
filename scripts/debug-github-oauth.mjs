// GitHub OAuth 配置调试脚本
// 用于诊断GitHub登录失败问题

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

console.log('🔍 GitHub OAuth 配置诊断开始...\n')

// 1. 检查环境变量
console.log('📋 环境变量检查:')
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SITE_URL'
]

requiredEnvVars.forEach(varName => {
  const value = process.env[varName]
  if (value) {
    console.log(`✅ ${varName}: ${value.substring(0, 20)}...`)
  } else {
    console.log(`❌ ${varName}: 未设置`)
  }
})

// 2. 检查站点URL配置
console.log('\n🌐 站点URL配置检查:')
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
if (siteUrl) {
  console.log(`当前配置的站点URL: ${siteUrl}`)
  
  if (siteUrl.includes('localhost') || siteUrl.includes('127.0.0.1')) {
    console.log('⚠️  警告: 站点URL仍然是本地地址，需要更新为生产域名')
  } else if (siteUrl.includes('your-chinese-blog.vercel.app')) {
    console.log('❌ 错误: 站点URL是占位符，需要更新为实际域名')
  } else {
    console.log('✅ 站点URL看起来正确')
  }
} else {
  console.log('❌ NEXT_PUBLIC_SITE_URL 未设置')
}

// 3. 检查回调URL
console.log('\n🔄 GitHub OAuth 回调URL检查:')
if (siteUrl) {
  const expectedCallbackUrl = `${siteUrl}/auth/callback`
  console.log(`预期的GitHub OAuth回调URL: ${expectedCallbackUrl}`)
  console.log('请确保在GitHub OAuth应用中配置了此URL')
} else {
  console.log('❌ 无法生成回调URL，因为站点URL未设置')
}

// 4. 检查Supabase配置
console.log('\n🗄️  Supabase配置检查:')
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
if (supabaseUrl) {
  try {
    const url = new URL(supabaseUrl)
    console.log(`✅ Supabase URL格式正确: ${url.hostname}`)
  } catch (error) {
    console.log(`❌ Supabase URL格式错误: ${error.message}`)
  }
} else {
  console.log('❌ NEXT_PUBLIC_SUPABASE_URL 未设置')
}

// 5. 生成修复建议
console.log('\n💡 修复建议:')
console.log('1. 更新 NEXT_PUBLIC_SITE_URL 为您的实际部署域名')
console.log('2. 在GitHub OAuth应用中配置正确的回调URL')
console.log('3. 在Supabase项目中配置GitHub OAuth')
console.log('4. 确保Supabase的Site URL和Redirect URLs正确')

// 6. 检查常见问题
console.log('\n🔧 常见问题检查:')
console.log('- GitHub OAuth应用是否已创建？')
console.log('- GitHub OAuth应用的Client ID和Secret是否在Supabase中正确配置？')
console.log('- Supabase项目的Authentication设置是否正确？')
console.log('- 部署平台的环境变量是否已设置？')

console.log('\n🎯 诊断完成!')
