@echo off
echo [WeTee Dev] Metro + ADB 설정 시작...

:: 8081 포트 기존 프로세스 종료
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8081" ^| findstr "LISTENING"') do (
  echo [WeTee Dev] 포트 8081 사용중인 PID %%a 종료
  taskkill /PID %%a /F >nul 2>&1
)

:: ADB reverse 설정
echo [WeTee Dev] ADB reverse 설정 중...
adb reverse tcp:8081 tcp:8081
if errorlevel 1 (
  echo [경고] ADB 연결 실패. USB 케이블과 디버깅 모드를 확인하세요.
) else (
  echo [WeTee Dev] ADB reverse 완료
)

:: Metro 시작
echo [WeTee Dev] Metro 번들러 시작...
npx expo start
