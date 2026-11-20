[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$CodingRoot,

    [switch]$ConfirmPrepare,

    [string]$RunId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $ConfirmPrepare) {
    throw "No files created. Re-run with -ConfirmPrepare after reviewing verification/ecc-01/README.md."
}

if ([string]::IsNullOrWhiteSpace($RunId)) {
    $RunId = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ") + "-P" + $PID
}
if ($RunId -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$') {
    throw "RunId must contain only letters, digits, dot, underscore or hyphen (1-64 chars)."
}

$rootItem = Get-Item -LiteralPath $CodingRoot -Force
if (-not $rootItem.PSIsContainer) {
    throw "CodingRoot must be an existing directory."
}
if (($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "CodingRoot must not be a reparse point or symlink."
}
$resolvedRoot = (Resolve-Path -LiteralPath $CodingRoot).Path

$suiteRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$fixturesRoot = Join-Path $suiteRoot "fixtures"
$tasksRoot = Join-Path $suiteRoot "tasks"
$baselineProfile = Join-Path $suiteRoot "profile-baseline.md"
$eccProfile = Join-Path $suiteRoot "profile-ecc-manual.md"
$resultTemplate = Join-Path $suiteRoot "result-template.json"

$taskMap = @(
    @{ Name = "01-research"; Fixture = "01-research"; TaskFile = "01-research.md" },
    @{ Name = "02-bugfix"; Fixture = "02-bugfix"; TaskFile = "02-bugfix.md" },
    @{ Name = "03-review"; Fixture = "03-review"; TaskFile = "03-review.md" }
)

$baseDir = Join-Path $resolvedRoot "_ecc01"
if (Test-Path -LiteralPath $baseDir) {
    $baseItem = Get-Item -LiteralPath $baseDir -Force
    if (-not $baseItem.PSIsContainer -or (($baseItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
        throw "_ecc01 exists but is not a regular directory."
    }
} else {
    New-Item -ItemType Directory -Path $baseDir | Out-Null
}

$finalRunRoot = Join-Path $baseDir $RunId
$stagingRoot = Join-Path $baseDir ("." + $RunId + ".staging")
if (Test-Path -LiteralPath $finalRunRoot) {
    throw "Run directory already exists; no files were overwritten: $finalRunRoot"
}
if (Test-Path -LiteralPath $stagingRoot) {
    throw "Staging directory already exists; inspect it manually before retrying: $stagingRoot"
}

New-Item -ItemType Directory -Path $stagingRoot | Out-Null
try {
    $arms = @(
        @{ Name = "A-baseline"; Profile = $baselineProfile },
        @{ Name = "B-ecc-manual"; Profile = $eccProfile }
    )

    foreach ($arm in $arms) {
        foreach ($task in $taskMap) {
            $armTaskRoot = Join-Path (Join-Path $stagingRoot $arm.Name) $task.Name
            $workspace = Join-Path $armTaskRoot "workspace"
            New-Item -ItemType Directory -Path $workspace -Force | Out-Null

            $fixtureSource = Join-Path $fixturesRoot $task.Fixture
            Get-ChildItem -LiteralPath $fixtureSource -Force | ForEach-Object {
                Copy-Item -LiteralPath $_.FullName -Destination $workspace -Recurse
            }

            $taskText = Get-Content -LiteralPath (Join-Path $tasksRoot $task.TaskFile) -Raw
            $workspacePath = (Resolve-Path -LiteralPath $workspace).Path
            $taskText = $taskText.Replace("{{WORKSPACE_ROOT}}", $workspacePath)
            Set-Content -LiteralPath (Join-Path $armTaskRoot "task.md") -Value $taskText -Encoding UTF8

            Copy-Item -LiteralPath $arm.Profile -Destination (Join-Path $armTaskRoot "profile.md")
            Copy-Item -LiteralPath $resultTemplate -Destination (Join-Path $armTaskRoot "result-template.json")
        }
    }

    $manifestEntries = @()
    Get-ChildItem -LiteralPath $stagingRoot -File -Recurse | Sort-Object FullName | ForEach-Object {
        $relative = $_.FullName.Substring($stagingRoot.Length).TrimStart('\')
        $hash = Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256
        $manifestEntries += [pscustomobject]@{
            path = $relative
            sha256 = $hash.Hash.ToLowerInvariant()
            length = $_.Length
        }
    }

    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    $nodeVersion = $null
    if ($nodeCommand) {
        $versionOutput = & node --version 2>$null
        if ($LASTEXITCODE -eq 0) { $nodeVersion = [string]$versionOutput }
    }

    $manifest = [ordered]@{
        schema = "cormia.ecc01.prepared.v1"
        runId = $RunId
        createdAt = (Get-Date).ToUniversalTime().ToString("o")
        sourceSuite = "verification/ecc-01"
        arms = @("A-baseline", "B-ecc-manual")
        tasks = @("01-research", "02-bugfix", "03-review")
        nodeVersion = $nodeVersion
        files = $manifestEntries
        note = "Synthetic fixture copies only. No live Agent data, credentials or model files are collected."
    }
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $stagingRoot "manifest.json") -Encoding UTF8

    Move-Item -LiteralPath $stagingRoot -Destination $finalRunRoot

    Write-Output "ECC-01 fixture pack prepared."
    Write-Output ("Run ID: " + $RunId)
    Write-Output ("Path: " + $finalRunRoot)
    Write-Output "Arms: A-baseline, B-ecc-manual"
    Write-Output "Tasks: 01-research, 02-bugfix, 03-review"
    Write-Output "No Agent task was started. No tests, hooks, MCP servers or model processes were executed."
} catch {
    if (Test-Path -LiteralPath $stagingRoot) {
        Remove-Item -LiteralPath $stagingRoot -Recurse -Force
    }
    throw
}
