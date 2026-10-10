param([switch]$Quiet)
$ErrorActionPreference = 'Stop'
$appRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
try {
  try { $health = Invoke-RestMethod -Uri 'http://127.0.0.1:4196/__hulan_health__' -TimeoutSec 1 -ErrorAction Stop } catch { exit 0 }
  if ($health.application -ne 'hulan-breath-rehab') { throw '端口 4196 的服务不属于壶兰呼吸，已保留原服务。' }
  $serviceProcess = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + [int]$health.pid)
  $expectedServer = Join-Path $appRoot 'scripts\serve.mjs'
  if (!$serviceProcess -or $serviceProcess.Name -ne 'node.exe' -or !$serviceProcess.CommandLine -or $serviceProcess.CommandLine.IndexOf($expectedServer, [StringComparison]::OrdinalIgnoreCase) -lt 0) { throw '该服务进程不属于这个电脑包，已保留原进程。请使用启动它的电脑包停止服务。' }
  Stop-Process -Id ([int]$health.pid) -ErrorAction Stop
} catch {
  if ($Quiet) { Write-Error $_; exit 1 }
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, '壶兰呼吸：停止未完成', 'OK', 'Error') | Out-Null
  exit 1
}
