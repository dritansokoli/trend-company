@echo off
title TREND COMPANY - Shkarkim nga Interneti
color 0D
cd /d "C:\Users\Dritan\trend-company"

echo.
echo  Duke shkarkuar te dhenat nga serveri online...
echo.

node download-data.js

echo.
echo ============================================
if %errorlevel% equ 0 (
    echo  SUKSES! Te dhenat u shkarkuan!
    echo  Rinis serverin lokal per te pare ndryshimet.
) else (
    echo  GABIM: Shkarkimi deshtoi!
    echo  Kontrollo mesazhet me siper.
)
echo ============================================
echo.
pause
