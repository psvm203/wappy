param([Parameter(Mandatory)][string]$Installer)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted') {
    throw 'Run this installer check only on a disposable GitHub-hosted Windows runner.'
}

$bundleId = 'com.wappy.client'
$runKey = 'Software\Microsoft\Windows\CurrentVersion\Run'
$approvalKey = 'Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run'
$installDir = Join-Path $env:RUNNER_TEMP 'Wappy 설치 확인'
$executable = Join-Path $installDir 'client.exe'
$uninstaller = Join-Path $installDir 'uninstall.exe'
$startupCommand = '"{0}" --autostart' -f $executable
# A Task Manager override must survive updates without silently re-enabling startup.
$approval = [byte[]](3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
$app = $null
$startupSeeded = $false

function Assert-Check([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}

function Read-Startup([string]$Key) {
    [Microsoft.Win32.Registry]::GetValue("HKEY_CURRENT_USER\$Key", $bundleId, $null)
}

function Run-Package([string]$File, [string]$Options) {
    # -Wait includes the temporary child process spawned by NSIS uninstallers.
    $process = Start-Process -FilePath $File -ArgumentList $Options -PassThru -Wait
    Assert-Check ($process.ExitCode -eq 0) "$File failed with exit code $($process.ExitCode)"
}

function Assert-Startup([string]$Command) {
    Assert-Check ((Read-Startup $runKey) -eq $Command) 'The startup command changed unexpectedly'
    $actual = [byte[]](Read-Startup $approvalKey)
    Assert-Check ($null -ne $actual) 'The Task Manager override was removed'
    Assert-Check ([BitConverter]::ToString($actual) -eq [BitConverter]::ToString($approval)) 'The Task Manager override changed'
}

function Seed-Startup([string]$Command) {
    [Microsoft.Win32.Registry]::SetValue("HKEY_CURRENT_USER\$runKey", $bundleId, $Command, 'String')
    [Microsoft.Win32.Registry]::SetValue("HKEY_CURRENT_USER\$approvalKey", $bundleId, $approval, 'Binary')
}

Assert-Check (-not (Test-Path $installDir)) 'The test installation directory already exists'
Assert-Check ($null -eq (Read-Startup $runKey) -and $null -eq (Read-Startup $approvalKey)) 'A Wappy startup entry already exists'
Assert-Check (-not (Test-Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Wappy')) 'Wappy is already installed'

try {
    Write-Host 'CHECK: install into a path with spaces and Korean characters; no automatic opt-in'
    # NSIS requires /D to be last and unquoted, including paths with spaces.
    Run-Package $Installer "/S /D=$installDir"
    Assert-Check ((Test-Path $executable) -and (Test-Path $uninstaller)) 'Installed binaries are missing'
    Assert-Check ($null -eq (Read-Startup $runKey) -and $null -eq (Read-Startup $approvalKey)) 'Installation enabled startup without consent'

    Write-Host 'CHECK: the installed release opens a native window'
    $app = Start-Process -FilePath $executable -PassThru
    Assert-Check ($app.WaitForInputIdle(15000)) 'The installed app did not initialize its UI'
    Start-Sleep -Seconds 5
    $app.Refresh()
    Assert-Check (-not $app.HasExited) 'The installed app exited unexpectedly'
    Assert-Check ($app.MainWindowHandle -ne 0) 'The installed app has no visible native window'
    Stop-Process -Id $app.Id -Force
    $app.WaitForExit()
    $app = $null

    # The native lifecycle check already exercises the real startup toggle.
    # Seed its persisted values here to test the installer boundary separately.
    $startupSeeded = $true
    Seed-Startup $startupCommand
    Write-Host 'CHECK: update and update-mode removal preserve startup and Task Manager settings'
    Run-Package $Installer "/S /UPDATE /D=$installDir"
    Assert-Startup $startupCommand
    Run-Package $uninstaller '/S /UPDATE'
    Assert-Check (-not (Test-Path $executable)) 'Update-mode removal left the app executable'
    Assert-Startup $startupCommand
    Run-Package $Installer "/S /D=$installDir"
    Assert-Startup $startupCommand

    Write-Host 'CHECK: ordinary removal deletes this installation and both startup values'
    Run-Package $uninstaller '/S'
    Assert-Check (-not (Test-Path $executable) -and -not (Test-Path $uninstaller)) 'Uninstall left executable files'
    Assert-Check ($null -eq (Read-Startup $runKey) -and $null -eq (Read-Startup $approvalKey)) 'Uninstall left startup values'

    Write-Host 'CHECK: removal preserves a startup entry pointing to another installation'
    Run-Package $Installer "/S /D=$installDir"
    $otherCommand = '"{0}" --autostart' -f (Join-Path $env:RUNNER_TEMP 'Another Wappy\client.exe')
    Seed-Startup $otherCommand
    Run-Package $uninstaller '/S'
    Assert-Startup $otherCommand
    Write-Host 'PASS: installed release launch, startup opt-in, update preservation and scoped uninstall cleanup'
} finally {
    if ($null -ne $app -and -not $app.HasExited) {
        Stop-Process -Id $app.Id -Force
        $app.WaitForExit()
    }
    if (Test-Path $uninstaller) { Run-Package $uninstaller '/S' }
    if ($startupSeeded) {
        foreach ($path in @($runKey, $approvalKey)) {
            $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($path, $true)
            if ($null -ne $key) {
                try { $key.DeleteValue($bundleId, $false) } finally { $key.Dispose() }
            }
        }
    }
}
