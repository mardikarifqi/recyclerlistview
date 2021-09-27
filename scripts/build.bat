@echo off

:: echo Running TSLint...
:: call npx tslint "src/**/*.{ts,tsx}"

echo Build started...
echo Removing old builds...
del /s /f /q dist

echo Removing DEV mode code...
echo Isolating WEB code...
cd src
call file-directives WEB,RELEASE

echo TSC: Building ES5 web package...
cd ..
call tsc --outDir dist/web

echo Isolating REACT-NATIVE code...
cd src
call file-directives REACT-NATIVE,RELEASE

echo TSC: Building ES5 react-native package...
cd ..
call tsc --outDir dist/reactnative

::echo Removing unnecessary files...
::rm -rf dist/reactnative/platform/web
::rm -rf dist/web/platform/reactnative

echo Resetting code state...
cd src
call file-directives REACT-NATIVE,DEV
cd ..

echo BUILD SUCCESS!
