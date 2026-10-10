param([Parameter(Mandatory=$true)][string]$InputFile)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime]::AllVoices | Where-Object { $_.Language -eq 'zh-CN' -and $_.DisplayName -eq 'Microsoft Huihui' } | Select-Object -First 1
if (!$voice) { throw 'A local zh-CN Windows speech voice is required for video generation.' }
$synth.Voice = $voice
$synth.Options.SpeakingRate = 0.9
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetParameters().Count -eq 1 } | Select-Object -First 1
$jobs = Get-Content -LiteralPath $InputFile -Raw -Encoding UTF8 | ConvertFrom-Json
try {
  foreach ($job in $jobs) {
    $task = $asTask.MakeGenericMethod([Windows.Media.SpeechSynthesis.SpeechSynthesisStream]).Invoke($null, @($synth.SynthesizeTextToStreamAsync($job.text)))
    $task.Wait()
    $stream = $task.Result
    $reader = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream)
    $output = [System.IO.File]::Create($job.output)
    try { $reader.CopyTo($output) } finally { $output.Dispose(); $reader.Dispose(); $stream.Dispose() }
  }
} finally { $synth.Dispose() }
Write-Output 'Local Chinese speech generated.'
