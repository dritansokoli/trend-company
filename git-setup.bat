@echo off
title TREND COMPANY - Git Setup
color 0A
cd /d "C:\Users\Dritan\trend-company"

echo ============================================
echo    TREND COMPANY - Git Setup
echo ============================================
echo.

echo [1/3] Duke shtuar skedaret...
git add .
echo.

echo [2/3] Duke krijuar commit...
git commit -m "TREND COMPANY - ready for deploy"
echo.

echo ============================================
echo  COMMIT U KRYE ME SUKSES!
echo.
echo  Tani shko te github.com dhe krijo nje
echo  repository te ri me emrin: trend-company
echo  (mos zgjidh asnje opsion, le ta bosh)
echo.
echo  Pastaj shkruaj emrin tend te GitHub ketu:
echo ============================================
echo.

set /p GITHUB_USER=Emri yt ne GitHub: 

echo.
echo Duke lidhur me GitHub...
git remote remove origin 2>nul
git remote add origin https://github.com/%GITHUB_USER%/trend-company.git
git branch -M main

echo.
echo [3/3] Duke ngarkuar ne GitHub...
git push -u origin main

echo.
echo ============================================
if %errorlevel% equ 0 (
    echo  SUKSES! Projekti u ngarkua ne GitHub!
    echo  https://github.com/%GITHUB_USER%/trend-company
) else (
    echo  GABIM: Kontrollo emrin e GitHub ose
    echo  sigurohu qe repository ekziston.
)
echo ============================================
echo.
pause
