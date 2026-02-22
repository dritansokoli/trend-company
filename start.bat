@echo off
title TREND COMPANY Server
color 0A
echo ============================================
echo    TREND COMPANY - Server Launcher
echo ============================================
echo.

cd /d "C:\Users\Dritan\trend-company"

if not exist "node_modules" (
    echo [1/2] Duke instaluar dependencat...
    npm install express better-sqlite3 multer bcryptjs express-session dotenv
    if errorlevel 1 (
        echo.
        echo GABIM: npm install deshtoi!
        echo Sigurohu qe Node.js eshte instaluar: node --version
        echo.
        pause
        exit /b 1
    )
    echo.
    echo Dependencat u instaluan me sukses!
    echo.
) else (
    echo Dependencat jane te instaluara.
    echo.
)

echo [2/2] Duke nisur serverin...
echo.
echo  Faqja kryesore:  http://localhost:3000
echo  Admin paneli:    http://localhost:3000/admin.html
echo  (admin / admin123)
echo.
echo  Per ta ndalur serverin, mbyll kete dritare.
echo ============================================
echo.

node server.js

echo.
echo Serveri u ndal.
pause
