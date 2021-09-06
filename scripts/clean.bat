@echo off
echo Deleting old packages...
::rm -rf node_modules
del /s /f /q dist

::echo Reinstalling packages...
::npm install