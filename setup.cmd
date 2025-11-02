@echo off
chcp 65001 >nul
echo Setting up WSL2 port forwarding...

REM Get WSL2 IP
for /f "tokens=1" %%i in ('wsl hostname -I') do set WSLIP=%%i
echo WSL2 IP: %WSLIP%

REM Remove existing rule
netsh interface portproxy delete v4tov4 listenport=3000 listenaddress=127.0.0.1

REM Add port forwarding
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=127.0.0.1 connectport=3000 connectaddress=%WSLIP%

echo Done! localhost:3000 now forwards to WSL2
netsh interface portproxy show all
pause