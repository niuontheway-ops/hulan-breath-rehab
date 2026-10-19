param([Parameter(Mandatory=$true)][string]$Installer)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$testRoot = Join-Path $projectRoot '.qa\installer\verification'
$installDirectory = Join-Path $testRoot 'installed'
$installerPath = (Resolve-Path -LiteralPath $Installer).Path
$checks = [Collections.Generic.List[object]]::new()
$uninstallKey = 'Registry::HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Uninstall\{DB85C771-A98D-438F-BA17-422A15E13FA9}_is1'
$exactEntries = @(
  (Join-Path ([Environment]::GetFolderPath('Desktop')) '壶兰呼吸康复工作台.lnk'),
  (Join-Path ([Environment]::GetFolderPath('Programs')) '壶兰呼吸康复工作台'),
  $uninstallKey
)
$before = @($exactEntries | ForEach-Object { Test-Path -LiteralPath $_ })
$completed = $false

function Check([string]$Name, [bool]$Passed) {
  $checks.Add([ordered]@{name=$Name;passed=$Passed})
  if (!$Passed) { throw ('Check failed: ' + $Name) }
}

function Read-Hash([string]$Path) {
  $stream = [IO.File]::OpenRead($Path)
  $algorithm = [Security.Cryptography.SHA256]::Create()
  try { return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
  finally { $algorithm.Dispose(); $stream.Dispose() }
}

function Read-Health {
  try { return Invoke-RestMethod -Uri 'http://127.0.0.1:4196/__hulan_health__' -TimeoutSec 2 } catch { return $null }
}

function Run-Installer([string]$LogName) {
  $arguments = @('/ISOLATEDTEST=1', ('/TESTROOT="' + $testRoot + '"'), ('/DIR="' + $installDirectory + '"'), '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/NOICONS', ('/LOG="' + (Join-Path $testRoot $LogName) + '"'))
  $process = Start-Process -FilePath $installerPath -ArgumentList $arguments -PassThru -WindowStyle Hidden -Wait
  Check ('Installer exit code: ' + $LogName) ($process.ExitCode -eq 0)
}

function Launch-Installed {
  $arguments = @('-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',('"' + (Join-Path $installDirectory 'scripts\desktop\launch.ps1') + '"'),'-NoBrowser')
  $launch = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $testRoot 'launch-output.json') -RedirectStandardError (Join-Path $testRoot 'launch-error.txt')
  $null = $launch.Handle
  if (!$launch.WaitForExit(30000)) { throw 'Launcher process did not exit after 30 seconds.' }
  Check 'Installed bundled runtime launches the app' ($launch.ExitCode -eq 0)
  return Read-Health
}

if (!$installerPath.StartsWith($projectRoot + '\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Installer must be in this project.' }
if (Test-Path -LiteralPath $installDirectory) { throw 'Previous isolated installation is present; review it before rerunning.' }
New-Item -ItemType Directory -Force -Path $testRoot | Out-Null
Check 'No running app occupies port 4196 before verification' ($null -eq (Read-Health))
$probe = New-Object Net.Sockets.TcpClient
try { $probe.Connect('127.0.0.1',4196); $occupied=$true } catch { $occupied=$false } finally { $probe.Dispose() }
Check 'No foreign listener occupies port 4196 before verification' (!$occupied)

try {
  Run-Installer 'install.log'
  Check 'Real uninstaller was installed' (Test-Path -LiteralPath (Join-Path $installDirectory 'unins000.exe'))
  Check 'Application identity marker was installed' (Test-Path -LiteralPath (Join-Path $installDirectory 'installation-info.json'))
  $manifest = Get-Content -LiteralPath (Join-Path $installDirectory '文件校验清单.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  $payloadMatches = $true
  foreach ($file in $manifest.files) {
    $target = Join-Path $installDirectory $file.path
    if (!(Test-Path -LiteralPath $target -PathType Leaf) -or (Read-Hash $target) -ne $file.sha256 -or (Get-Item -LiteralPath $target).Length -ne $file.bytes) { $payloadMatches=$false;break }
  }
  Check 'Every installed payload file matches SHA-256 and byte count' $payloadMatches
  $health = Launch-Installed
  Check 'Health endpoint identifies the app' ($health.application -eq 'hulan-breath-rehab')
  $listener = Get-NetTCPConnection -State Listen -OwningProcess ([int]$health.pid)
  Check 'Bundled service listens on loopback only' (@($listener).Count -eq 1 -and $listener.LocalAddress -eq '127.0.0.1' -and $listener.LocalPort -eq 4196)
  $page = Invoke-WebRequest -Uri 'http://127.0.0.1:4196/' -UseBasicParsing
  Check 'Installed app returns its actual HTML' ($page.StatusCode -eq 200 -and $page.Content.Contains('rehab-workbench-container'))
  $again = Launch-Installed
  Check 'Repeated launch reuses the same owned process' ($health.pid -eq $again.pid)
  Run-Installer 'upgrade.log'
  Check 'Reinstall safely stops the old owned service before replacement' ($null -eq (Read-Health))
  $afterUpgrade = Launch-Installed
  Check 'Installed app launches after same-directory update' ($afterUpgrade.application -eq 'hulan-breath-rehab')
  $uninstaller = Join-Path $installDirectory 'unins000.exe'
  $uninstallLog = Join-Path $testRoot 'uninstall.log'
  $uninstall = Start-Process -FilePath $uninstaller -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART',('/LOG="'+$uninstallLog+'"')) -PassThru -WindowStyle Hidden -Wait
  Check 'Real uninstaller exits successfully' ($uninstall.ExitCode -eq 0)
  Check 'Uninstall safely stops the installed service' ($null -eq (Read-Health))
  Check 'Uninstall removes the installed application directory' (!(Test-Path -LiteralPath $installDirectory))
  $occupiedDirectory = Join-Path $testRoot 'occupied'
  New-Item -ItemType Directory -Path $occupiedDirectory | Out-Null
  $sentinel = Join-Path $occupiedDirectory 'keep.txt'
  Set-Content -LiteralPath $sentinel -Value 'preserve-this-file' -Encoding ASCII
  $rejected = Start-Process -FilePath $installerPath -ArgumentList @('/ISOLATEDTEST=1',('/TESTROOT="'+$testRoot+'"'),('/DIR="'+$occupiedDirectory+'"'),'/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/NOICONS',('/LOG="'+(Join-Path $testRoot 'occupied-guard.log')+'"')) -PassThru -WindowStyle Hidden -Wait
  Check 'Installer refuses a nonempty unrelated directory' ($rejected.ExitCode -ne 0)
  Check 'Unrelated file is preserved and no app is copied there' ((Get-Content -LiteralPath $sentinel -Raw).Trim() -eq 'preserve-this-file' -and !(Test-Path -LiteralPath (Join-Path $occupiedDirectory 'installation-info.json')))
  Remove-Item -LiteralPath $sentinel
  Remove-Item -LiteralPath $occupiedDirectory
  $outsideDirectory = Join-Path (Split-Path -Parent $testRoot) 'outside-test-root'
  if (Test-Path -LiteralPath $outsideDirectory) { throw 'An earlier guard target is present; review it first.' }
  $outside = Start-Process -FilePath $installerPath -ArgumentList @('/ISOLATEDTEST=1',('/TESTROOT="'+$testRoot+'"'),('/DIR="'+$outsideDirectory+'"'),'/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/NOICONS',('/LOG="'+(Join-Path $testRoot 'isolation-guard.log')+'"')) -PassThru -WindowStyle Hidden -Wait
  Check 'Isolated mode refuses targets outside TESTROOT' ($outside.ExitCode -ne 0 -and !(Test-Path -LiteralPath $outsideDirectory))
  for ($index=0;$index -lt $exactEntries.Count;$index++) { Check ('No system shortcut or application registration change: '+$index) ((Test-Path -LiteralPath $exactEntries[$index]) -eq $before[$index]) }
  $registrationLog = Select-String -LiteralPath (Join-Path $testRoot 'install.log'),(Join-Path $testRoot 'upgrade.log') -Pattern 'Creating registry key|Creating shortcut|Writing registry value'
  Check 'Isolated install logs show no shortcut or registry writes' (!$registrationLog)
  $completed = $true
} finally {
  [ordered]@{application='hulan-breath-rehab';installer=(Split-Path -Leaf $installerPath);mode='isolated-no-icons-no-registration';checks=$checks;allPassed=($completed -and @($checks | Where-Object { !$_.passed }).Count -eq 0);installedDirectoryRemains=Test-Path -LiteralPath $installDirectory;healthAfter=Read-Health} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $testRoot 'verification.json') -Encoding UTF8
}
$checks | ForEach-Object { [pscustomobject]$_ } | Format-Table -AutoSize
