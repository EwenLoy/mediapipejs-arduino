@echo off
echo ========================================
echo   Роборука - Локальный сервер
echo ========================================
echo.
echo Запуск сервера на http://localhost:8000
echo.
echo Откройте в браузере: http://localhost:8000
echo.
echo Для остановки нажмите Ctrl+C
echo ========================================
echo.

python -m http.server 8000
