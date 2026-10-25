; NSIS appends the last folder of InstallDir to whatever the user picks with Browse, so the path field always ends with the app folder.
!macro customHeader
  InstallDir "$LOCALAPPDATA\Programs\${APP_FILENAME}"
!macroend
