@echo off
echo Starting Music Streaming App...
echo.
echo Make sure Node.js is installed on your system.
echo If you get errors, run: npm install
echo.
echo Starting development server...
echo.

REM Try the regular npm script first
npm run dev

REM If that fails, this batch file will close
REM In that case, try running in PowerShell:
REM npx cross-env NODE_ENV=development tsx server/index.ts

echo.
echo If the server started successfully, open your browser to:
echo http://localhost:5000
echo.
echo Press any key to exit...
pause > nul