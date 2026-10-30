@echo off
title BOLIHON booking - allow network access
rem Lets PCs on the server's own subnet reach BOLIHON on port 3030 through Windows Firewall.
rem It applies on every network profile, because a server NIC on an unidentified network is
rem classed Public; remoteip=localsubnet keeps the port closed to anything beyond that subnet.
rem Run it once, as administrator.

net session >nul 2>nul || (echo Right-click this file and choose "Run as administrator". & pause & exit /b 1)

netsh advfirewall firewall delete rule name="BOLIHON booking" >nul 2>nul
netsh advfirewall firewall add rule name="BOLIHON booking" dir=in action=allow protocol=TCP localport=3030 profile=any remoteip=localsubnet || (pause & exit /b 1)

echo.
echo PCs on this server's subnet can now reach BOLIHON on port 3030.
echo To undo this later, run as administrator:
echo   netsh advfirewall firewall delete rule name="BOLIHON booking"
pause
