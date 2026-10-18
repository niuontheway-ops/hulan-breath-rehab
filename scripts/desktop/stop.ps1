param([switch]$Quiet)
. (Join-Path $PSScriptRoot 'common.ps1')
try {
  $health = Read-HulanHealth
  if (!$health) { exit 0 }
  $expectedFingerprint = Get-HulanFingerprint
  $ownedProcess = Get-HulanServiceProcess $health $expectedFingerprint
  $healthAgain = Read-HulanHealth
  if (!$healthAgain -or $healthAgain.pid -ne $health.pid -or $healthAgain.fingerprint -ne $health.fingerprint) {
    throw '本机服务已发生变化，未停止任何进程。请重新检查后再试。'
  }
  $null = Get-HulanServiceProcess $healthAgain $expectedFingerprint
  Stop-Process -Id ([int]$ownedProcess.ProcessId) -ErrorAction Stop
} catch {
  if ($Quiet) { Write-Error $_; exit 1 }
  Show-HulanError $_.Exception.Message '壶兰呼吸：停止未完成'
  exit 1
}
