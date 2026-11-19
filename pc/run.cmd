@echo off

rem Chroniques d'un futur anterieur - build and render a film on this PC. Usage: run.cmd <film|all> [res] [from_s to_s]

setlocal

rem a Python with torch, spandrel and Pillow is needed for the upscaling: set PYTHONPATH here if they live in another environment

set PYTHONUTF8=1

cd /d %~dp0

python run.py %*

