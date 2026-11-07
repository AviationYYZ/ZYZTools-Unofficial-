!ifndef BUILD_UNINSTALLER
!macro customFinishPage
  Function StartApp
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "--updated"
  FunctionEnd
  Function ZYZFinish
    ${If} ${isForceRun}
    ${AndIf} ${isUpdated}
      Call StartApp
      Abort
    ${EndIf}
  FunctionEnd
  !define MUI_PAGE_CUSTOMFUNCTION_PRE ZYZFinish
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !insertmacro MUI_PAGE_FINISH
!macroend
!endif
