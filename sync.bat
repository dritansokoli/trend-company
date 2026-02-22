@echo off
title TREND COMPANY - Sinkronizim
color 0B
cd /d "C:\Users\Dritan\trend-company"

echo ============================================
echo    TREND COMPANY - Sinkronizim Online
echo ============================================
echo.

echo [1/4] Duke eksportuar te dhenat lokale...
node export-data.js
if %errorlevel% neq 0 (
    echo.
    echo GABIM: Eksportimi deshtoi!
    echo Sigurohu qe serveri ka punuar te pakten njehere.
    echo.
    pause
    exit /b 1
)
echo.

echo [2/4] Duke shtuar skedaret...
git add .
echo.

echo [3/4] Duke krijuar commit...
set /p MSG=Shkruaj mesazhin e ndryshimit (ose ENTER per default): 
if "%MSG%"=="" set MSG=Sinkronizim - %date% %time:~0,5%
git commit -m "%MSG%"
echo.

echo [4/4] Duke ngarkuar ne GitHub...
git push
echo.

echo ============================================
if %errorlevel% equ 0 (
    echo  SUKSES! Ndryshimet u ngarkuan ne GitHub!
    echo.
    echo  Render.com do ta riperditesoje faqen
    echo  automatikisht brenda 2-5 minutash.
) else (
    echo  GABIM: Push deshtoi!
    echo  Kontrollo lidhjen me internet ose
    echo  ekzekuto njehere: git-setup.bat
)
echo ============================================
echo.
pause
