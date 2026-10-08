!macro NSIS_HOOK_POSTUNINSTALL
  ; Startup uses the bundle identifier, not NSIS's product-name entry.
  ; Keep opt-in and Task Manager overrides during updates or for another install.
  ${If} $UpdateMode <> 1
    Push $0
    ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${BUNDLEID}"
    ${If} $0 == '"$INSTDIR\${MAINBINARYNAME}.exe" --autostart'
      DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${BUNDLEID}"
      DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "${BUNDLEID}"
    ${EndIf}
    Pop $0
  ${EndIf}
!macroend
