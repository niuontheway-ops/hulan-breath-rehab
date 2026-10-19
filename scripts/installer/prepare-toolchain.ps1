param()
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$toolRoot = Join-Path $projectRoot '.qa\installer\toolchain'
$compilerDirectory = Join-Path $toolRoot 'inno'
$downloadPath = Join-Path $toolRoot 'innosetup-6.7.3.exe'
$signaturePath = $downloadPath + '.issig'
$expectedHash = '9c73c3bae7ed48d44112a0f48e66742c00090bdb5bef71d9d3c056c66e97b732'
$officialUrl = 'https://github.com/jrsoftware/issrc/releases/download/is-6_7_3/innosetup-6.7.3.exe'
$logPath = Join-Path $toolRoot 'portable-install.log'

function Read-Sha256([string]$Path) {
  $stream = [IO.File]::OpenRead($Path)
  $algorithm = [Security.Cryptography.SHA256]::Create()
  try { return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
  finally { $algorithm.Dispose(); $stream.Dispose() }
}

New-Item -ItemType Directory -Force -Path $toolRoot | Out-Null
if (!(Test-Path -LiteralPath $downloadPath)) { Invoke-WebRequest -Uri $officialUrl -OutFile $downloadPath }
if (!(Test-Path -LiteralPath $signaturePath)) { Invoke-WebRequest -Uri ($officialUrl + '.issig') -OutFile $signaturePath }
if ((Read-Sha256 $downloadPath) -ne $expectedHash) { throw 'Inno Setup compiler download checksum does not match the pinned official release.' }
$signatureText = Get-Content -LiteralPath $signaturePath -Raw
if ($signatureText -notmatch ('(?m)^file-hash ' + $expectedHash + '\s*$')) { throw 'Official checksum metadata does not match.' }
$authenticode = Get-AuthenticodeSignature -LiteralPath $downloadPath
if ($authenticode.Status -ne 'Valid' -or $authenticode.SignerCertificate.Subject -notmatch '(?:^|, )CN=Pyrsys B\.V\.(?:,|$)') {
  throw 'The official compiler Authenticode signature is not valid for Pyrsys B.V.'
}

$arguments = @('/PORTABLE=1', '/VERYSILENT', '/CURRENTUSER', '/NORESTART', '/NOICONS', '/TASKS=', ('/DIR="' + $compilerDirectory + '"'), ('/LOG="' + $logPath + '"'))
$portableProcess = Start-Process -FilePath $downloadPath -ArgumentList $arguments -PassThru -WindowStyle Hidden -Wait
if ($portableProcess.ExitCode -ne 0 -or !(Test-Path -LiteralPath (Join-Path $compilerDirectory 'ISCC.exe'))) { throw 'Portable compiler extraction failed.' }
[ordered]@{version='6.7.3';source=$officialUrl;sha256=$expectedHash;signatureStatus=[string]$authenticode.Status;publisher=$authenticode.SignerCertificate.Subject;mode='portable';compiler=Join-Path $compilerDirectory 'ISCC.exe'} |
  ConvertTo-Json | Set-Content -LiteralPath (Join-Path $toolRoot 'verification.json') -Encoding UTF8
Write-Output (Join-Path $compilerDirectory 'ISCC.exe')
