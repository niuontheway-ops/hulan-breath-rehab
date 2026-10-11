param([Parameter(Mandatory=$true)][string]$SourceDirectory, [Parameter(Mandatory=$true)][string]$DestinationFile)
$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath $SourceDirectory).Path
$target = [IO.Path]::GetFullPath($DestinationFile)
if ([IO.Path]::GetDirectoryName($target) -ne [IO.Path]::GetDirectoryName($source) -or [IO.Path]::GetExtension($target) -ne '.zip') { throw 'Archive destination must be a ZIP next to the package directory.' }
if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($source, $target, [IO.Compression.CompressionLevel]::Optimal, $false)
