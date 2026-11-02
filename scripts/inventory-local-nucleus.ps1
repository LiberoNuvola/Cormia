[CmdletBinding()]
param(
    [string]$OutputPath = (Join-Path $env:TEMP "cormia-local-nucleus-inventory.json")
)

$ErrorActionPreference = "Stop"

$Roots = [ordered]@{
    LocalAgent      = "E:\AI\Immortal-Agent-v0.7"
    CodingWorkspace = "E:\AI\Immortal-CodingLab\workspace"
    ControlRoom     = "E:\AI\Immortal-Control-Room"
    McpBridge       = "E:\AI\Immortal-MCP"
}

$SkippedDirectories = @(
    ".git", "node_modules", "data", "models", "model", "weights",
    "checkpoints", ".cache", "cache", "logs", "artifacts", "dist",
    "build", "target", ".next", ".venv", "venv", "coverage"
)

$AllowedExtensions = @(
    ".mjs", ".js", ".cjs", ".ts", ".tsx", ".jsx", ".json",
    ".ps1", ".psm1", ".psd1", ".yml", ".yaml", ".toml", ".md"
)

$SensitiveNamePattern = '(^\.env($|\.)|secret|credential|token|password|private.?key|id_rsa|wallet|mnemonic)'
$MaxFileBytes = 10MB

function Get-SafePackageMetadata {
    param([string]$PackagePath)

    try {
        $package = Get-Content -LiteralPath $PackagePath -Raw | ConvertFrom-Json
        $dependencies = @()
        $devDependencies = @()
        if ($package.dependencies) {
            $dependencies = @($package.dependencies.PSObject.Properties | ForEach-Object { $_.Name })
        }
        if ($package.devDependencies) {
            $devDependencies = @($package.devDependencies.PSObject.Properties | ForEach-Object { $_.Name })
        }

        $scriptNames = @()
        if ($package.scripts) {
            $scriptNames = @($package.scripts.PSObject.Properties | ForEach-Object { $_.Name })
        }

        return [pscustomobject]@{
            Path = $PackagePath
            Name = $package.name
            Version = $package.version
            Type = $package.type
            Main = $package.main
            NodeEngine = $package.engines.node
            DependencyNames = $dependencies
            DevDependencyNames = $devDependencies
            ScriptNames = $scriptNames
        }
    }
    catch {
        return [pscustomobject]@{
            Path = $PackagePath
            Error = "package.json could not be parsed"
        }
    }
}

$RootReports = @()

foreach ($entry in $Roots.GetEnumerator()) {
    $rootName = [string]$entry.Key
    $rootPath = [string]$entry.Value

    if (-not (Test-Path -LiteralPath $rootPath -PathType Container)) {
        $RootReports += [pscustomobject]@{
            Name = $rootName
            Path = $rootPath
            Exists = $false
            FileCount = 0
            TotalBytes = 0
            Files = @()
            Packages = @()
        }
        continue
    }

    $files = New-Object System.Collections.Generic.List[object]
    $packages = New-Object System.Collections.Generic.List[object]
    $pending = New-Object 'System.Collections.Generic.Queue[string]'
    $pending.Enqueue($rootPath)

    while ($pending.Count -gt 0) {
        $current = $pending.Dequeue()

        foreach ($item in @(Get-ChildItem -LiteralPath $current -Force -ErrorAction SilentlyContinue)) {
            if ($item.PSIsContainer) {
                if ($SkippedDirectories -contains $item.Name) { continue }
                if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
                $pending.Enqueue($item.FullName)
                continue
            }

            if ($item.Name -match $SensitiveNamePattern) { continue }
            if ($AllowedExtensions -notcontains $item.Extension.ToLowerInvariant()) { continue }
            if ($item.Length -gt $MaxFileBytes) { continue }

            $relativePath = $item.FullName.Substring($rootPath.TrimEnd('\').Length).TrimStart('\')
            try {
                $digest = (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
            }
            catch {
                continue
            }

            $files.Add([pscustomobject]@{
                Path = $relativePath
                Extension = $item.Extension.ToLowerInvariant()
                Bytes = [long]$item.Length
                Sha256 = $digest
                LastWriteTimeUtc = $item.LastWriteTimeUtc.ToString("o")
            })

            if ($item.Name -eq "package.json") {
                $packages.Add((Get-SafePackageMetadata -PackagePath $item.FullName))
            }
        }
    }

    $sortedFiles = @($files | Sort-Object Path)
    $totalBytes = 0L
    foreach ($file in $sortedFiles) { $totalBytes += [long]$file.Bytes }

    $RootReports += [pscustomobject]@{
        Name = $rootName
        Path = $rootPath
        Exists = $true
        FileCount = $sortedFiles.Count
        TotalBytes = $totalBytes
        Files = $sortedFiles
        Packages = @($packages)
    }
}

$report = [pscustomobject]@{
    Schema = "cormia.local-nucleus-inventory.v1"
    GeneratedAtUtc = [DateTime]::UtcNow.ToString("o")
    CollectionMode = "metadata-only"
    Exclusions = @(
        "No source file contents are collected",
        "No task/session/audit data directories",
        "No .env, secret, credential, token, password, wallet or private-key named files",
        "No Git objects, node_modules, model weights, caches, logs, artifacts or build outputs",
        "No files larger than 10 MiB",
        "No symbolic-link directories are traversed"
    )
    Roots = $RootReports
}

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

$json = $report | ConvertTo-Json -Depth 10
$encoding = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($OutputPath, $json, $encoding)

Write-Host "Cormia local nucleus inventory completed."
Write-Host "Output: $OutputPath"
foreach ($root in $RootReports) {
    Write-Host ("{0}: exists={1}; files={2}; bytes={3}" -f $root.Name, $root.Exists, $root.FileCount, $root.TotalBytes)
}
Write-Host "No source contents, task data, secrets, model weights, logs or Git objects were collected."
