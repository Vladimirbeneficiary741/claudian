param(
  [string]$OutputDir = "..\\..\\claudian-public"
)

$ErrorActionPreference = "Stop"

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content
  )

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

$root = Split-Path -Parent $PSScriptRoot
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$destination = Join-Path $root ("{0}-{1}" -f $OutputDir.TrimEnd('\'), $timestamp)

New-Item -ItemType Directory -Path $destination -Force | Out-Null

$exclude = @(
  ".git",
  "node_modules",
  ".env.local",
  ".claude",
  ".codex",
  ".obsidian",
  ".claudian",
  "coverage",
  "test-results",
  "temp_tail.txt",
  "AGENTS.md",
  "CLAUDE.md",
  "README.public.md",
  ".context",
  ".codex-plugin"
)

Get-ChildItem -LiteralPath $root -Force | ForEach-Object {
  if ($exclude -contains $_.Name) {
    return
  }

  Copy-Item -LiteralPath $_.FullName -Destination $destination -Recurse -Force
}

Get-ChildItem -LiteralPath $destination -Recurse -File | Where-Object {
  $_.Name -in @("CLAUDE.md", "AGENTS.md") -or $_.Name -like "*.log" -or $_.Name -like "*.tmp"
} | Remove-Item -Force

$publicReadme = Join-Path $root "README.public.md"
$targetReadme = Join-Path $destination "README.md"
if (Test-Path $publicReadme) {
  Copy-Item -LiteralPath $publicReadme -Destination $targetReadme -Force
}

$packageJsonPath = Join-Path $destination "package.json"
if (Test-Path $packageJsonPath) {
  $packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
  $packageJson.author = ""
  $packageJson.description = "Claudian - Obsidian AI agent plugin with Claude Code, Codex, and optional environment-based DeepSeek compatibility"
  Write-Utf8NoBom -Path $packageJsonPath -Content ($packageJson | ConvertTo-Json -Depth 100)
}

$manifestPath = Join-Path $destination "manifest.json"
if (Test-Path $manifestPath) {
  $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
  $manifest.author = ""
  Write-Utf8NoBom -Path $manifestPath -Content ($manifest | ConvertTo-Json -Depth 20)
}

$noticePath = Join-Path $destination "NOTICE.md"
if (Test-Path $noticePath) {
  $noticeText = Get-Content $noticePath -Raw
  $noticeText = $noticeText -replace '(?m)^- Release author.*\r?\n', ''
  Write-Utf8NoBom -Path $noticePath -Content $noticeText
}

$envExamplePath = Join-Path $destination ".env.local.example"
if (Test-Path $envExamplePath) {
  Write-Utf8NoBom -Path $envExamplePath -Content (@(
    "# Optional: local Obsidian vault path for development-only auto copy"
    "# OBSIDIAN_VAULT=/absolute/path/to/your/vault"
  ) -join [Environment]::NewLine)
}

$auditScript = Join-Path $root "scripts\audit-public-release.mjs"
if (Test-Path $auditScript) {
  node $auditScript $destination
}

Write-Host "Public repository exported to: $destination"
