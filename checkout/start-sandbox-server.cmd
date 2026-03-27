@echo off
setlocal
set PHP_BIN=C:\xampp\php\php.exe
set PROJECT_ROOT=%~dp0

if not exist "%PHP_BIN%" (
  echo PHP executable not found at "%PHP_BIN%".
  echo Update PHP_BIN in checkout\start-sandbox-server.cmd to match your local PHP install.
  exit /b 1
)

echo Starting PayPal sandbox checkout at http://127.0.0.1:8080/checkout/
start "YT Focus Clean Sandbox Checkout" cmd /k ""%PHP_BIN%" -S 127.0.0.1:8080 -t "%PROJECT_ROOT%..\""
