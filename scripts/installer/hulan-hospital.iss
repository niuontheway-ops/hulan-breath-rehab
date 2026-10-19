#ifndef AppVersion
  #error AppVersion is required
#endif
#ifndef PayloadDirectory
  #error PayloadDirectory is required
#endif
#ifndef InstallerOutputDirectory
  #error InstallerOutputDirectory is required
#endif

[Setup]
AppId={{DB85C771-A98D-438F-BA17-422A15E13FA9}
AppName=壶兰呼吸康复工作台
AppVersion={#AppVersion}
AppPublisher=壶兰呼吸 · 呼吸医学科三区
AppPublisherURL=https://niuontheway-ops.github.io/hulan-breath-rehab/
DefaultDirName={localappdata}\Programs\HulanBreathRehab
DefaultGroupName=壶兰呼吸康复工作台
DisableProgramGroupPage=yes
DisableDirPage=no
PrivilegesRequired=lowest
ArchitecturesAllowed=x64os
ArchitecturesInstallIn64BitMode=x64os
MinVersion=10.0
OutputDir={#InstallerOutputDirectory}
OutputBaseFilename=hulan-breath-rehab-{#AppVersion}-windows-x64-setup
SetupIconFile={#PayloadDirectory}\dist\assets\clinical\desktop.ico
UninstallDisplayIcon={app}\dist\assets\clinical\desktop.ico
UninstallDisplayName=壶兰呼吸康复工作台
Compression=lzma2/normal
SolidCompression=yes
WizardStyle=modern
WizardSizePercent=110
DisableWelcomePage=no
InfoBeforeFile=installation-note.txt
Uninstallable=yes
CreateUninstallRegKey=not IsIsolatedTest
UpdateUninstallLogAppName=no
UsePreviousAppDir=no
UsePreviousGroup=no
UsePreviousLanguage=no
UsePreviousTasks=no
UsePreviousSetupType=no
CloseApplications=no
RestartApplications=no
ChangesAssociations=no
ChangesEnvironment=no
SetupLogging=yes
AllowNetworkDrive=no
AllowUNCPath=no
DirExistsWarning=auto
VersionInfoDescription=壶兰呼吸康复工作台安装程序
VersionInfoProductName=壶兰呼吸康复工作台
VersionInfoCompany=壶兰呼吸
VersionInfoVersion={#AppVersion}

[Languages]
Name: "chinesesimp"; MessagesFile: "ChineseSimplified.isl"

[Tasks]
Name: "desktopicon"; Description: "在此医院电脑的桌面创建入口"; GroupDescription: "快捷方式："; Check: not IsIsolatedTest
Name: "startmenuicon"; Description: "在开始菜单中创建入口与卸载入口"; GroupDescription: "快捷方式："; Check: not IsIsolatedTest

[Files]
Source: "{#PayloadDirectory}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{userdesktop}\壶兰呼吸康复工作台"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\scripts\desktop\launch.ps1"""; WorkingDir: "{app}"; IconFilename: "{app}\dist\assets\clinical\desktop.ico"; Tasks: desktopicon; Check: not IsIsolatedTest
Name: "{userprograms}\壶兰呼吸康复工作台\壶兰呼吸康复工作台"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\scripts\desktop\launch.ps1"""; WorkingDir: "{app}"; IconFilename: "{app}\dist\assets\clinical\desktop.ico"; Tasks: startmenuicon; Check: not IsIsolatedTest
Name: "{userprograms}\壶兰呼吸康复工作台\停止本机康复服务"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\scripts\desktop\stop.ps1"""; WorkingDir: "{app}"; IconFilename: "{app}\dist\assets\clinical\desktop.ico"; Tasks: startmenuicon; Check: not IsIsolatedTest
Name: "{userprograms}\壶兰呼吸康复工作台\卸载壶兰呼吸康复工作台"; Filename: "{uninstallexe}"; WorkingDir: "{app}"; IconFilename: "{app}\dist\assets\clinical\desktop.ico"; Tasks: startmenuicon; Check: not IsIsolatedTest

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\scripts\desktop\launch.ps1"""; Description: "打开壶兰呼吸康复工作台"; WorkingDir: "{app}"; Flags: postinstall nowait skipifsilent unchecked; Check: not IsIsolatedTest

[Code]
function IsIsolatedTest: Boolean;
begin
  Result := ExpandConstant('{param:ISOLATEDTEST|0}') = '1';
end;

function IsTestDirectoryAllowed(const Directory: String): Boolean;
var
  TestRoot, Target: String;
begin
  TestRoot := ExpandConstant('{param:TESTROOT|}');
  Result := False;
  if TestRoot = '' then Exit;
  TestRoot := AddBackslash(ExpandFileName(TestRoot));
  Target := AddBackslash(ExpandFileName(Directory));
  Result := (CompareText(Copy(Target, 1, Length(TestRoot)), TestRoot) = 0) and
    (Length(Target) > Length(TestRoot));
end;

function HasExistingFiles(const Directory: String): Boolean;
var
  Entry: TFindRec;
begin
  Result := False;
  if not DirExists(Directory) then Exit;
  if FindFirst(AddBackslash(Directory) + '*', Entry) then begin
    try
      repeat
        if (Entry.Name <> '.') and (Entry.Name <> '..') then begin
          Result := True;
          Exit;
        end;
      until not FindNext(Entry);
    finally
      FindClose(Entry);
    end;
  end;
end;

function IsHulanInstallation(const Directory: String): Boolean;
var
  Marker: AnsiString;
begin
  Result := LoadStringFromFile(AddBackslash(Directory) + 'installation-info.json', Marker) and
    (Pos('"application":"hulan-breath-rehab"', Marker) > 0) and
    FileExists(AddBackslash(Directory) + 'scripts\desktop\stop.ps1') and
    FileExists(AddBackslash(Directory) + 'dist\build-info.json');
end;

function StopOwnedService(const Directory: String): Boolean;
var
  ResultCode: Integer;
  Parameters: String;
begin
  Parameters := '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' +
    AddBackslash(Directory) + 'scripts\desktop\stop.ps1" -Quiet';
  Result := Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    Parameters, Directory, SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := Result and (ResultCode = 0);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Directory: String;
begin
  Result := '';
  Directory := WizardDirValue;
  if IsIsolatedTest and not IsTestDirectoryAllowed(Directory) then begin
    Result := '隔离验收仅可安装到 /TESTROOT 指定目录内的子文件夹。';
    Exit;
  end;
  if HasExistingFiles(Directory) then begin
    if not IsHulanInstallation(Directory) then begin
      Result := '该目录中已有其他文件。请选择一个空目录，避免影响现有资料。';
      Exit;
    end;
    if not StopOwnedService(Directory) then
      Result := '现有康复服务未能安全停止。请使用原程序的停止入口结束服务后，再运行安装程序。';
  end;
end;

function InitializeUninstall: Boolean;
var
  Directory: String;
begin
  Directory := ExpandConstant('{app}');
  Result := IsHulanInstallation(Directory) and StopOwnedService(Directory);
  if not Result then
    MsgBox('未能核验或安全停止此安装目录的康复服务，已取消卸载并保留原进程。请先使用原程序停止服务后重试。', mbError, MB_OK);
end;
