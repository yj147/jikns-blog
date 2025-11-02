# WSL2 端口转发设置脚本
# 在Windows PowerShell中以管理员身份运行此脚本

Write-Host "=== WSL2 端口转发设置 ===" -ForegroundColor Green

# 获取WSL2的IP地址
$wslIp = bash.exe -c "hostname -I | awk '{print `$1}'"
$wslIp = $wslIp.Trim()

Write-Host "检测到WSL2 IP地址: $wslIp" -ForegroundColor Yellow

# 删除现有的端口转发规则（如果存在）
Write-Host "清理现有端口转发规则..." -ForegroundColor Blue
netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=127.0.0.1 2>$null
netsh interface portproxy delete v4tov4 listenport=54321 listenaddress=127.0.0.1 2>$null
netsh interface portproxy delete v4tov4 listenport=54323 listenaddress=127.0.0.1 2>$null

# 设置端口转发
Write-Host "设置端口转发规则..." -ForegroundColor Blue

# Next.js 应用 (3000 -> WSL2:3000)
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=127.0.0.1 connectport=3000 connectaddress=$wslIp
Write-Host "✅ 设置 localhost:3000 -> $wslIp:3000" -ForegroundColor Green

# Supabase API (54321 -> WSL2:54321)
netsh interface portproxy add v4tov4 listenport=54321 listenaddress=127.0.0.1 connectport=54321 connectaddress=$wslIp
Write-Host "✅ 设置 localhost:54321 -> $wslIp:54321" -ForegroundColor Green

# Supabase Studio (54323 -> WSL2:54323)
netsh interface portproxy add v4tov4 listenport=54323 listenaddress=127.0.0.1 connectport=54323 connectaddress=$wslIp
Write-Host "✅ 设置 localhost:54323 -> $wslIp:54323" -ForegroundColor Green

# 显示当前的端口转发规则
Write-Host "`n=== 当前端口转发规则 ===" -ForegroundColor Green
netsh interface portproxy show all

# 配置Windows防火墙规则
Write-Host "`n配置防火墙规则..." -ForegroundColor Blue
New-NetFirewallRule -DisplayName "WSL2 Port 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow 2>$null
New-NetFirewallRule -DisplayName "WSL2 Port 54321" -Direction Inbound -Protocol TCP -LocalPort 54321 -Action Allow 2>$null
New-NetFirewallRule -DisplayName "WSL2 Port 54323" -Direction Inbound -Protocol TCP -LocalPort 54323 -Action Allow 2>$null

Write-Host "`n🎉 端口转发设置完成！现在你可以使用以下地址访问：" -ForegroundColor Green
Write-Host "📱 Next.js 应用: http://localhost:3000" -ForegroundColor Cyan
Write-Host "🔌 Supabase API: http://localhost:54321" -ForegroundColor Cyan  
Write-Host "🎛️ Supabase Studio: http://localhost:54323" -ForegroundColor Cyan

Write-Host "`n⚠️  注意：如果WSL2重启后IP地址改变，需要重新运行此脚本" -ForegroundColor Yellow

pause