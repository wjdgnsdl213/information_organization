$ErrorActionPreference = 'Stop'
$hwp = New-Object -ComObject HWPFrame.HwpObject
$hwp.XHwpWindows.Item(0).Visible = $false
$null = $hwp.RegisterModule('FilePathCheckDLL', 'raonkhwp')
$null = $hwp.SetMessageBoxMode(0x20000)
try {
    foreach ($count in @(2, 12)) {
        $path = Join-Path (Get-Location) "tmp/verification/quote-$count.hwpx"
        if (-not $hwp.Open($path, 'HWPX', 'forceopen:true')) { throw "Hancom rejected $path" }
        Write-Output "OPEN quote-$count.hwpx=True"
        Write-Output "PAGES=$($hwp.PageCount)"
        $saved = Join-Path (Get-Location) "tmp/verification/verified-$count.hwpx"
        if (-not $hwp.SaveAs($saved, 'HWPX', '')) { throw 'HWPX save failed' }
        if (-not (Test-Path -LiteralPath $saved)) { throw 'Saved file missing' }
        $hwp.Clear(1)
    }
} finally { $hwp.Quit() }
