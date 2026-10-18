param([switch]$NoBrowser)
. (Join-Path $PSScriptRoot 'common.ps1')
try {
  if (!(Test-Path -LiteralPath (Join-Path $appRoot 'dist\index.html') -PathType Leaf) -or
      !(Test-Path -LiteralPath $serverPath -PathType Leaf)) { throw '请先解压完整电脑包，再打开壶兰呼吸。当前文件夹缺少网页或启动文件。' }
  if (!(Test-Path -LiteralPath $nodePath -PathType Leaf) -or
      !(Test-Path -LiteralPath (Join-Path $appRoot 'runtime\runtime-info.json') -PathType Leaf)) { throw '电脑包缺少自带运行程序，请重新完整解压。不需要另行安装 Node.js。' }
  $runtimeInfo = Get-Content -LiteralPath (Join-Path $appRoot 'runtime\runtime-info.json') -Raw | ConvertFrom-Json
  if ($runtimeInfo.version -ne 'v24.19.0' -or $runtimeInfo.platform -ne 'win32' -or $runtimeInfo.arch -ne 'x64' -or
      (Get-HulanFileSha256 $nodePath) -ne $runtimeInfo.nodeSha256) {
    throw '电脑包的运行程序校验未通过，请重新完整解压。'
  }
  $expectedFingerprint = Get-HulanFingerprint
  $health = Read-HulanHealth
  if ($health) { $null = Get-HulanServiceProcess $health $expectedFingerprint }
  if (!$health) {
    $probe = New-Object System.Net.Sockets.TcpClient
    try { $probe.Connect('127.0.0.1', 4196); $occupied = $true } catch { $occupied = $false } finally { $probe.Dispose() }
    if ($occupied) { throw '本机端口 4196 被其他服务占用，已保留原服务。请关闭该服务后再试。' }
    $previousPort = $env:PORT
    try {
      $env:PORT = '4196'
      $serverProcess = Start-Process -FilePath $nodePath -ArgumentList ('"' + $serverPath + '"') -WorkingDirectory $appRoot -WindowStyle Hidden -PassThru
    } finally { $env:PORT = $previousPort }
    try {
      for ($attempt = 0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Milliseconds 500
        $health = Read-HulanHealth
        if ($health) { $null = Get-HulanServiceProcess $health $expectedFingerprint; break }
        $serverProcess.Refresh()
        if ($serverProcess.HasExited) { break }
      }
      if (!$health) { throw '本机服务未能启动，请检查电脑包是否完整以及端口 4196 是否被占用。' }
      $null = Get-HulanServiceProcess $health $expectedFingerprint
    } catch {
      $serverProcess.Refresh()
      if (!$serverProcess.HasExited) { Stop-Process -InputObject $serverProcess -ErrorAction SilentlyContinue }
      throw
    }
  }
  if ($NoBrowser) { Write-Output ($health | ConvertTo-Json -Compress) } else { Start-Process -FilePath $appUrl }
} catch {
  if ($NoBrowser) { Write-Error $_; exit 1 }
  Show-HulanError $_.Exception.Message '壶兰呼吸：启动未完成'
  exit 1
}
