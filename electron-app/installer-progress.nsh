!include "nsDialogs.nsh"

!ifndef BUILD_UNINSTALLER
Var ZYZBar
Var ZYZRing
Var ZYZPercent
Var ZYZFont

!macro customPageAfterChangeDir
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW ZYZProgressShow
  !define MUI_PAGE_CUSTOMFUNCTION_LEAVE ZYZProgressLeave
!macroend

Function ZYZProgressShow
  FindWindow $0 "#32770" "" $HWNDPARENT
  GetDlgItem $ZYZBar $0 1004
  ${If} $ZYZBar == 0
    Return
  ${EndIf}
  ; Use native dialog units for centering and DPI scaling.
  System::Call '*(i 0,i 0,i 100,i 40) p.r1'
  System::Call 'user32::MapDialogRect(p r0,p r1)'
  System::Call '*$1(i,i,i.r2,i.r3)'
  System::Call 'user32::GetClientRect(p r0,p r1)'
  System::Call '*$1(i,i,i.r4,i.r5)'
  System::Free $1
  IntOp $4 $4 - $2
  IntOp $4 $4 / 2
  IntOp $5 $5 / 3
  System::Call 'user32::CreateWindowExW(i 0,w "STATIC",w "◯",i 0x50000001,i r4,i r5,i r2,i r3,p r0,p 0,p 0,p 0) p.s'
  Pop $ZYZRing
  IntOp $5 $5 + $3
  System::Call 'user32::CreateWindowExW(i 0,w "STATIC",w "0%",i 0x50000001,i r4,i r5,i r2,i 26,p r0,p 0,p 0,p 0) p.s'
  Pop $ZYZPercent
  CreateFont $ZYZFont "Segoe UI Symbol" 27 400
  SendMessage $ZYZRing ${WM_SETFONT} $ZYZFont 1
  ${NSD_CreateTimer} ZYZProgressTick 90
FunctionEnd

Function ZYZProgressTick
  Push $0
  Push $1
  Push $2
  System::Call 'user32::IsWindow(p $ZYZBar) i.r0'
  ${If} $0 != 0
    SendMessage $ZYZBar 0x408 0 0 $0
    SendMessage $ZYZBar 0x407 0 0 $1
    ${If} $0 > 0
      IntOp $1 $1 * 100
      IntOp $1 $1 / $0
      StrCpy $2 "◯"
      ${If} $1 >= 100
        StrCpy $2 "●"
      ${ElseIf} $1 >= 75
        StrCpy $2 "◕"
      ${ElseIf} $1 >= 50
        StrCpy $2 "◑"
      ${ElseIf} $1 >= 25
        StrCpy $2 "◔"
      ${EndIf}
      SendMessage $ZYZRing ${WM_SETTEXT} 0 "STR:$2"
      SendMessage $ZYZPercent ${WM_SETTEXT} 0 "STR:$1%"
    ${EndIf}
  ${EndIf}
  Pop $2
  Pop $1
  Pop $0
FunctionEnd

Function ZYZProgressLeave
  ${NSD_KillTimer} ZYZProgressTick
  System::Call 'user32::DestroyWindow(p $ZYZRing)'
  System::Call 'user32::DestroyWindow(p $ZYZPercent)'
  System::Call 'gdi32::DeleteObject(p $ZYZFont)'
FunctionEnd

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
