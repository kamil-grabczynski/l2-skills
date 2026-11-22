@echo off
rem Builds the calculator and opens it in the browser (http://localhost:4173).
cd /d "%~dp0"
if not exist node_modules call npm install
call npm run start
