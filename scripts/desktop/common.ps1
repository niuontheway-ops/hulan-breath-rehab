$ErrorActionPreference = 'Stop'
$appRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$appBaseUrl = 'http://127.0.0.1:4196/'
$appUrl = $appBaseUrl + '#clinic'
$healthUrl = $appBaseUrl + '__hulan_health__'
$nodePath = Join-Path $appRoot 'runtime\node.exe'
$serverPath = Join-Path $appRoot 'scripts\serve.mjs'
$buildPath = Join-Path $appRoot 'dist\build-info.json'

function Read-HulanHealth {
  try { return Invoke-RestMethod -Uri $healthUrl -TimeoutSec 1 -ErrorAction Stop } catch { return $null }
}

function Get-HulanFileSha256([string]$Path) {
  $stream = $null
  $algorithm = $null
  try {
    $stream = [IO.File]::OpenRead($Path)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-', '').ToLowerInvariant()
  } finally {
    if ($algorithm) { $algorithm.Dispose() }
    if ($stream) { $stream.Dispose() }
  }
}

function Get-HulanFingerprint {
  if (!(Test-Path -LiteralPath $buildPath -PathType Leaf)) { throw '电脑包缺少构建信息，请重新完整解压。' }
  return Get-HulanFileSha256 $buildPath
}

function Get-HulanServiceProcess($Health, [string]$Fingerprint) {
  if (!$Health -or $Health.application -ne 'hulan-breath-rehab' -or $Health.fingerprint -ne $Fingerprint -or !$Health.pid) {
    throw '端口 4196 的服务与这个电脑包不一致，已保留原服务。请先使用启动该服务的电脑包停止服务。'
  }
  $servicePid = 0
  if (![int]::TryParse([string]$Health.pid, [ref]$servicePid) -or $servicePid -le 0) { throw '本机服务返回了无效的进程编号，已保留原服务。' }
  $serviceProcess = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $servicePid)
  $quotedServer = '"' + $serverPath + '"'
  $serverArgument = '(?:^|\s)' + [regex]::Escape($quotedServer) + '(?:\s|$)'
  if (!$serviceProcess -or $serviceProcess.Name -ne 'node.exe' -or
      ![string]::Equals([string]$serviceProcess.ExecutablePath, $nodePath, [StringComparison]::OrdinalIgnoreCase) -or
      !$serviceProcess.CommandLine -or ![regex]::IsMatch($serviceProcess.CommandLine, $serverArgument, [Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
    throw '该服务进程不属于这个电脑包，已保留原进程。请使用启动它的电脑包停止服务。'
  }
  return $serviceProcess
}

function Show-HulanError([string]$Message, [string]$Title) {
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show($Message, $Title, 'OK', 'Error') | Out-Null
}
