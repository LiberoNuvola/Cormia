[CmdletBinding()]
param(
    [string]$OutputPath = (Join-Path $env:TEMP ("cormia-source-review-" + [DateTime]::UtcNow.ToString("yyyyMMdd-HHmmss") + ".zip"))
)

$ErrorActionPreference = "Stop"

$Roots = @{
    LocalAgent = "E:\AI\Immortal-Agent-v0.7"
    CodingWorkspace = "E:\AI\Immortal-CodingLab\workspace"
    ControlRoom = "E:\AI\Immortal-Control-Room"
    McpBridge = "E:\AI\Immortal-MCP"
}

# Explicit allowlist. No config files, backups, task stores, logs, credentials or model data.
$Candidates = @(
    [pscustomobject]@{ Root="LocalAgent"; Relative="agent.mjs"; Archive="LocalAgent/agent.mjs" }
    [pscustomobject]@{ Root="LocalAgent"; Relative="coding-workspace.mjs"; Archive="LocalAgent/coding-workspace.mjs" }
    [pscustomobject]@{ Root="LocalAgent"; Relative="README.md"; Archive="LocalAgent/README.md" }
    [pscustomobject]@{ Root="LocalAgent"; Relative="tests\http-service.test.mjs"; Archive="LocalAgent/tests/http-service.test.mjs" }
    [pscustomobject]@{ Root="LocalAgent"; Relative="tests\mock-e2e.test.mjs"; Archive="LocalAgent/tests/mock-e2e.test.mjs" }

    [pscustomobject]@{ Root="CodingWorkspace"; Relative="coding-workspace-under-test.mjs"; Archive="CodingWorkspace/coding-workspace-under-test.mjs" }
    [pscustomobject]@{ Root="CodingWorkspace"; Relative="coding-workspace.test.mjs"; Archive="CodingWorkspace/coding-workspace.test.mjs" }
    [pscustomobject]@{ Root="CodingWorkspace"; Relative="self-improvement\evolution-manager.mjs"; Archive="CodingWorkspace/self-improvement/evolution-manager.mjs" }
    [pscustomobject]@{ Root="CodingWorkspace"; Relative="self-improvement\resource-manager.mjs"; Archive="CodingWorkspace/self-improvement/resource-manager.mjs" }
    [pscustomobject]@{ Root="CodingWorkspace"; Relative="self-improvement\self-improvement.test.mjs"; Archive="CodingWorkspace/self-improvement/self-improvement.test.mjs" }
    [pscustomobject]@{ Root="CodingWorkspace"; Relative="self-improvement\README.md"; Archive="CodingWorkspace/self-improvement/README.md" }

    [pscustomobject]@{ Root="ControlRoom"; Relative="control-room.mjs"; Archive="ControlRoom/control-room.mjs" }
    [pscustomobject]@{ Root="ControlRoom"; Relative="README.md"; Archive="ControlRoom/README.md" }
    [pscustomobject]@{ Root="ControlRoom"; Relative="tests\safety-contract.test.mjs"; Archive="ControlRoom/tests/safety-contract.test.mjs" }

    [pscustomobject]@{ Root="McpBridge"; Relative="jev-readonly-mcp.mjs"; Archive="McpBridge/jev-readonly-mcp.mjs" }
)

$SecretPatterns = [ordered]@{
    GitHubToken = 'gh[pousr]_[A-Za-z0-9_]{20,}'
    GitHubFineGrainedToken = 'github_pat_[A-Za-z0-9_]{20,}'
    AwsAccessKey = '\bAKIA[0-9A-Z]{16}\b'
    PrivateKeyPem = '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'
    CredentialAssignment = '(?i)\b(api[_-]?key|access[_-]?token|client[_-]?secret|password|mnemonic|seed.?phrase)\b\s*[:=]\s*["''][^"'']{12,}["'']'
}

$Resolved = @()
$Findings = @()

foreach ($candidate in $Candidates) {
    $rootPath = $Roots[$candidate.Root]
    if (-not (Test-Path -LiteralPath $rootPath -PathType Container)) {
        throw "Root directory missing: $($candidate.Root)"
    }

    $fullPath = Join-Path $rootPath $candidate.Relative
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        throw "Allowlisted source file missing: $fullPath"
    }

    $item = Get-Item -LiteralPath $fullPath
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Refusing a reparse-point source file: $fullPath"
    }
    if ($item.Length -gt 2MB) {
        throw "Source file exceeds 2 MiB review limit: $fullPath"
    }

    $lineNumber = 0
    foreach ($line in [IO.File]::ReadAllLines($fullPath)) {
        $lineNumber++
        foreach ($pattern in $SecretPatterns.GetEnumerator()) {
            if ($line -match $pattern.Value) {
                $Findings += [pscustomobject]@{
                    File = "$($candidate.Root)/$($candidate.Relative)"
                    Line = $lineNumber
                    Pattern = $pattern.Key
                }
            }
        }
    }

    $Resolved += [pscustomobject]@{
        Root = $candidate.Root
        Relative = $candidate.Relative
        FullPath = $fullPath
        Archive = $candidate.Archive
        Bytes = [long]$item.Length
        Sha256 = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash.ToLowerInvariant()
    }
}

if ($Findings.Count -gt 0) {
    Write-Host "Potential credential-like values found. No archive was created." -ForegroundColor Yellow
    $Findings | Format-Table -AutoSize
    throw "Review the listed source lines locally; do not upload this archive until resolved."
}

$staging = Join-Path $env:TEMP ("cormia-source-review-staging-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $staging -Force | Out-Null

try {
    foreach ($file in $Resolved) {
        $destination = Join-Path $staging ($file.Archive.Replace("/", "\"))
        $destinationDirectory = Split-Path -Parent $destination
        New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
        Copy-Item -LiteralPath $file.FullPath -Destination $destination
    }

    $manifest = [pscustomobject]@{
        Schema = "cormia.source-review-bundle.v1"
        GeneratedAtUtc = [DateTime]::UtcNow.ToString("o")
        CollectionMode = "explicit-source-allowlist"
        IncludedFiles = @($Resolved | ForEach-Object {
            [pscustomobject]@{
                ArchivePath = $_.Archive
                SourceRoot = $_.Root
                RelativePath = $_.Relative
                Bytes = $_.Bytes
                Sha256 = $_.Sha256
            }
        })
        Exclusions = @(
            "No config.json files",
            "No backups or historical candidate snapshots",
            "No task/session/audit stores",
            "No environment files, credentials, wallet data or private keys",
            "No model weights, dependency trees, caches, logs or build outputs",
            "No Git objects or repository metadata",
            "High-confidence credential-pattern scan passed; manual review is still required"
        )
    }

    $manifestPath = Join-Path $staging "MANIFEST.json"
    [IO.File]::WriteAllText(
        $manifestPath,
        ($manifest | ConvertTo-Json -Depth 8),
        (New-Object System.Text.UTF8Encoding($false))
    )

    $outputDirectory = Split-Path -Parent $OutputPath
    if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
        New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
    }

    if (Test-Path -LiteralPath $OutputPath) {
        throw "Output already exists; choose a new OutputPath: $OutputPath"
    }

    Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $OutputPath -CompressionLevel Optimal

    $archive = Get-Item -LiteralPath $OutputPath
    $archiveHash = (Get-FileHash -LiteralPath $OutputPath -Algorithm SHA256).Hash.ToLowerInvariant()

    Write-Host "Cormia source-review archive created."
    Write-Host "Archive: $($archive.FullName)"
    Write-Host "Files: $($Resolved.Count)"
    Write-Host "Bytes: $($Resolved | Measure-Object -Property Bytes -Sum | Select-Object -ExpandProperty Sum)"
    Write-Host "SHA256: $archiveHash"
    Write-Host "Review the archive contents before attaching it to the chat."
    Write-Host "This script does not upload or transmit any file."
}
finally {
    if (Test-Path -LiteralPath $staging) {
        Remove-Item -LiteralPath $staging -Recurse -Force
    }
}
