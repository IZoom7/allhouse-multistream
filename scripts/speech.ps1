$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$speechRequest = [Console]::In.ReadToEnd() | ConvertFrom-Json
Add-Type -AssemblyName System.Speech
$speechEngine = New-Object System.Speech.Synthesis.SpeechSynthesizer

# Newer Windows voices (OneCore), e.g. the Thai "Microsoft Pattara" from the Thai speech pack, are invisible to
# System.Speech. They are reached through the Windows Runtime speech API instead. All of it runs offline.
function Get-OneCoreSynth {
    try {
        Add-Type -AssemblyName System.Runtime.WindowsRuntime
        $null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
        return New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
    } catch { return $null }
}
function Wait-WinRT($operation, [Type]$resultType) {
    $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
    $task = $asTask.MakeGenericMethod($resultType).Invoke($null, @($operation))
    $null = $task.Wait(20000)
    return $task.Result
}

try {
    $desktopVoices = @($speechEngine.GetInstalledVoices() | Where-Object { $_.Enabled } | ForEach-Object { $_.VoiceInfo })
    if ($speechRequest.action -eq 'voices') {
        $speechVoices = @($desktopVoices | ForEach-Object { @{ name = $_.Name; lang = $_.Culture.Name; localService = $true } })
        $oneCore = Get-OneCoreSynth
        if ($oneCore) {
            $known = @($desktopVoices | ForEach-Object { $_.Name })
            foreach ($v in [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices) {
                if ($known -notcontains $v.DisplayName) { $speechVoices += @{ name = $v.DisplayName; lang = $v.Language; localService = $true } }
            }
            $oneCore.Dispose()
        }
        @{ voices = $speechVoices } | ConvertTo-Json -Compress -Depth 3
    } elseif ($speechRequest.action -eq 'speak') {
        if ([string]::IsNullOrWhiteSpace($speechRequest.text) -or $speechRequest.text.Length -gt 1000) {
            throw 'Invalid speech text length.'
        }
        $voiceName = [string]$speechRequest.voice
        if (-not ($desktopVoices | Where-Object { $_.Name -eq $voiceName })) {
            $oneCore = Get-OneCoreSynth
            $voice = if ($oneCore) { [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.DisplayName -eq $voiceName } | Select-Object -First 1 }
            if (-not $voice) { throw 'The selected voice is not installed.' }
            try {
                $oneCore.Voice = $voice
                $oneCore.Options.SpeakingRate = [Math]::Max(0.5, [Math]::Min(2, [double]$speechRequest.rate))
                $oneCore.Options.AudioVolume = [Math]::Max(0, [Math]::Min(1, [double]$speechRequest.volume))
                $stream = Wait-WinRT ($oneCore.SynthesizeTextToStreamAsync([string]$speechRequest.text)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
                $speechBuffer = New-Object System.IO.MemoryStream
                try {
                    [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream).CopyTo($speechBuffer)
                    @{ audio = ('data:audio/wav;base64,' + [Convert]::ToBase64String($speechBuffer.ToArray())) } | ConvertTo-Json -Compress
                } finally { $speechBuffer.Dispose(); $stream.Dispose() }
            } finally { $oneCore.Dispose() }
            return
        }
        $speechEngine.SelectVoice($voiceName)
        $speechEngine.Rate = [int][Math]::Max(-10, [Math]::Min(10, ([double]$speechRequest.rate - 1) * 8))
        $speechEngine.Volume = [int][Math]::Max(0, [Math]::Min(100, [double]$speechRequest.volume * 100))
        $speechBuffer = New-Object System.IO.MemoryStream
        try {
            $speechEngine.SetOutputToWaveStream($speechBuffer)
            $speechEngine.Speak([string]$speechRequest.text)
            $speechEngine.SetOutputToNull()
            @{ audio = ('data:audio/wav;base64,' + [Convert]::ToBase64String($speechBuffer.ToArray())) } | ConvertTo-Json -Compress
        } finally {
            $speechBuffer.Dispose()
        }
    } else {
        throw 'Unknown speech request.'
    }
} finally {
    $speechEngine.Dispose()
}
