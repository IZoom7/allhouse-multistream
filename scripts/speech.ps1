$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$speechRequest = [Console]::In.ReadToEnd() | ConvertFrom-Json
Add-Type -AssemblyName System.Speech
$speechEngine = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    if ($speechRequest.action -eq 'voices') {
        $speechVoices = @($speechEngine.GetInstalledVoices() |
            Where-Object { $_.Enabled } |
            ForEach-Object { @{ name = $_.VoiceInfo.Name; lang = $_.VoiceInfo.Culture.Name; localService = $true } })
        @{ voices = $speechVoices } | ConvertTo-Json -Compress -Depth 3
    } elseif ($speechRequest.action -eq 'speak') {
        if ([string]::IsNullOrWhiteSpace($speechRequest.text) -or $speechRequest.text.Length -gt 1000) {
            throw 'Invalid speech text length.'
        }
        $speechEngine.SelectVoice([string]$speechRequest.voice)
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
