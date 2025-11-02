@echo off
echo === WSL2 永久端口转发设置 ===

REM 获取WSL2 IP地址
for /f "tokens=*" %%i in ('wsl hostname -I') do set WSLIP=%%i
echo WSL2 IP地址: %WSLIP%

REM 清理现有规则
netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=127.0.0.1 >nul 2>&1

REM 设置端口转发
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=127.0.0.1 connectport=3000 connectaddress=%WSLIP%
echo ✅ 设置端口转发: localhost:3000 -> %WSLIP%:3000

REM 配置防火墙
netsh advfirewall firewall delete rule name="WSL2-3000" >nul 2>&1
netsh advfirewall firewall add rule name="WSL2-3000" dir=in action=allow protocol=TCP localport=3000 >nul 2>&1
echo ✅ 配置防火墙规则

REM 显示结果
echo.
echo === 端口转发规则 ===
netsh interface portproxy show all

echo.
echo 🎉 设置完成! 现在可以直接使用 localhost:3000 访问了!
pause