@echo off
setlocal
set PHP_BIN=C:\xampp\php\php.exe
set PROJECT_ROOT=%~dp0
echo Starting PayPal sandbox checkout at http://127.0.0.1:8080/checkout/
start "YT Focus Clean Sandbox Checkout" cmd /k ""%PHP_BIN%" -S 127.0.0.1:8080 -t "%PROJECT_ROOT%\.."""
