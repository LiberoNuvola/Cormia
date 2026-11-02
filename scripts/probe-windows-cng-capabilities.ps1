# Read-only discovery of Windows CNG KSP provider and algorithm availability.
# This script does NOT create/open/delete keys, modify certificates, write files,
# change TPM state, or export key material. It reports provider inventory only.

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not ("CormiaCngProbeNative" -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class CormiaCngProbeNative
{
    [StructLayout(LayoutKind.Sequential)]
    public struct NCryptAlgorithmName
    {
        public IntPtr pszName;
        public uint dwClass;
        public uint dwAlgOperations;
        public uint dwFlags;
    }

    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    public static extern int NCryptOpenStorageProvider(
        out IntPtr phProvider,
        string pszProviderName,
        uint dwFlags);

    [DllImport("ncrypt.dll", CharSet = CharSet.Unicode)]
    public static extern int NCryptEnumAlgorithms(
        IntPtr hProvider,
        uint dwAlgOperations,
        out uint pdwAlgCount,
        out IntPtr ppAlgList,
        uint dwFlags);

    [DllImport("ncrypt.dll")]
    public static extern int NCryptFreeBuffer(IntPtr pvInput);

    [DllImport("ncrypt.dll")]
    public static extern int NCryptFreeObject(IntPtr hObject);
}
'@
}

function Format-NCryptStatus {
    param([int]$Status)
    $unsigned = [BitConverter]::ToUInt32([BitConverter]::GetBytes($Status), 0)
    return ("0x{0:X8}" -f $unsigned)
}

$providerNames = @(
    "Microsoft Platform Crypto Provider",
    "Microsoft Software Key Storage Provider"
)

$providerResults = foreach ($providerName in $providerNames) {
    $providerHandle = [IntPtr]::Zero
    $algorithmBuffer = [IntPtr]::Zero
    $providerStatus = [CormiaCngProbeNative]::NCryptOpenStorageProvider(
        [ref]$providerHandle,
        $providerName,
        0
    )

    if ($providerStatus -ne 0) {
        [pscustomobject]@{
            providerId = $providerName
            available = $false
            status = Format-NCryptStatus $providerStatus
            algorithms = @()
        }
        continue
    }

    try {
        [uint32]$algorithmCount = 0
        $enumStatus = [CormiaCngProbeNative]::NCryptEnumAlgorithms(
            $providerHandle,
            0,
            [ref]$algorithmCount,
            [ref]$algorithmBuffer,
            0
        )

        if ($enumStatus -ne 0) {
            [pscustomobject]@{
                providerId = $providerName
                available = $true
                status = Format-NCryptStatus $enumStatus
                algorithms = @()
            }
            continue
        }

        $algorithms = [System.Collections.Generic.List[string]]::new()
        $recordSize = [Runtime.InteropServices.Marshal]::SizeOf(
            [type][CormiaCngProbeNative+NCryptAlgorithmName]
        )

        for ($index = 0; $index -lt $algorithmCount; $index++) {
            $recordPointer = [IntPtr]::Add($algorithmBuffer, ($index * $recordSize))
            $record = [Runtime.InteropServices.Marshal]::PtrToStructure(
                $recordPointer,
                [type][CormiaCngProbeNative+NCryptAlgorithmName]
            )
            $algorithmName = [Runtime.InteropServices.Marshal]::PtrToStringUni($record.pszName)
            if (-not [string]::IsNullOrWhiteSpace($algorithmName)) {
                $algorithms.Add($algorithmName)
            }
        }

        [pscustomobject]@{
            providerId = $providerName
            available = $true
            status = "0x00000000"
            algorithms = @($algorithms | Sort-Object -Unique)
        }
    }
    finally {
        if ($algorithmBuffer -ne [IntPtr]::Zero) {
            [void][CormiaCngProbeNative]::NCryptFreeBuffer($algorithmBuffer)
        }
        if ($providerHandle -ne [IntPtr]::Zero) {
            [void][CormiaCngProbeNative]::NCryptFreeObject($providerHandle)
        }
    }
}

$tpmResult = $null
if (Get-Command Get-Tpm -ErrorAction SilentlyContinue) {
    try {
        $tpm = Get-Tpm -ErrorAction Stop
        $tpmResult = [pscustomobject]@{
            queryAvailable = $true
            tpmPresent = [bool]$tpm.TpmPresent
            tpmReady = [bool]$tpm.TpmReady
            tpmEnabled = [bool]$tpm.TpmEnabled
        }
    }
    catch {
        $tpmResult = [pscustomobject]@{
            queryAvailable = $true
            querySucceeded = $false
            errorCategory = [string]$_.CategoryInfo.Category
        }
    }
}
else {
    $tpmResult = [pscustomobject]@{
        queryAvailable = $false
    }
}

$result = [pscustomobject]@{
    probeVersion = "0.1.0"
    probeMode = "read-only-provider-discovery"
    osVersion = [Environment]::OSVersion.Version.ToString()
    tpm = $tpmResult
    providers = @($providerResults)
    createsKeys = $false
    readsPrivateKeyMaterial = $false
    changesMachineState = $false
}

$result | ConvertTo-Json -Depth 6
