$ErrorActionPreference = 'Stop'
$hwp = New-Object -ComObject HWPFrame.HwpObject
$hwp.XHwpWindows.Item(0).Visible = $false
$null = $hwp.RegisterModule('FilePathCheckDLL', 'raonkhwp')
$null = $hwp.SetMessageBoxMode(0x20000)
try {
    foreach ($name in @('quote-2', 'quote-12', 'production')) {
        $path = Join-Path (Get-Location) "tmp/verification/$name.hwpx"
        if (-not $hwp.Open($path, 'HWPX', 'forceopen:true')) { throw "Hancom rejected $path" }
        Write-Output "OPEN $name.hwpx=True"
        Write-Output "PAGES=$($hwp.PageCount)"
        $saved = Join-Path (Get-Location) "tmp/verification/verified-$name.hwpx"
        if (-not $hwp.SaveAs($saved, 'HWPX', '')) { throw 'HWPX save failed' }
        if (-not (Test-Path -LiteralPath $saved)) { throw 'Saved file missing' }
        $hwp.Clear(1)
    }
} finally { $hwp.Quit() }
