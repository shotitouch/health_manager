# PreToolUse hook for ExitPlanMode.
# Blocks plan approval until an HTML plan doc exists for THIS plan and is current.
#
# Identity + currency check (see docs/decisions/process.md):
#   - Reads transcript_path from the hook payload to find the active plan's slug
#     (the harness-assigned ~/.claude/plans/<slug>.md, recorded in the transcript).
#   - Requires .claude/tmp/<slug>-plan.html to exist AND be at least as new as the
#     plan .md (so a revised/rejected plan can't be approved against a stale HTML).
#
# Fails OPEN (exit 0) whenever it cannot determine the plan — never blocks real work
# on a parsing edge case; only blocks when it positively knows the HTML is missing/stale.

$ErrorActionPreference = 'Stop'

try {
    $raw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }

    $payload = $raw | ConvertFrom-Json
    $transcript = $payload.transcript_path
    $cwd = $payload.cwd
    if (-not $transcript -or -not (Test-Path -LiteralPath $transcript)) { exit 0 }
    if (-not $cwd) { $cwd = (Get-Location).Path }

    $text = Get-Content -LiteralPath $transcript -Raw

    # Plan paths appear JSON-escaped (plans\\<slug>.md) or with forward slashes.
    # Take the LAST match — most recent plan-mode activation in this session.
    $matches = [regex]::Matches($text, 'plans(?:\\{1,2}|/)([A-Za-z0-9._-]+)\.md')
    if ($matches.Count -eq 0) { exit 0 }
    $slug = $matches[$matches.Count - 1].Groups[1].Value

    $htmlPath = Join-Path $cwd ".claude\tmp\$slug-plan.html"
    $planMd = Join-Path $env:USERPROFILE ".claude\plans\$slug.md"

    $htmlExists = Test-Path -LiteralPath $htmlPath
    if (-not $htmlExists) {
        [Console]::Error.WriteLine("Have you generated the HTML plan for this? I don't see .claude/tmp/$slug-plan.html. Per CLAUDE.md Plan Mode: write the HTML plan to that exact path and open it (Start-Process), then call ExitPlanMode again.")
        exit 2
    }

    # Currency: HTML must be at least as new as the plan markdown it represents.
    if (Test-Path -LiteralPath $planMd) {
        $htmlTime = (Get-Item -LiteralPath $htmlPath).LastWriteTimeUtc
        $mdTime = (Get-Item -LiteralPath $planMd).LastWriteTimeUtc
        if ($htmlTime -lt $mdTime) {
            [Console]::Error.WriteLine("The HTML plan .claude/tmp/$slug-plan.html is older than your latest plan edits. Regenerate the HTML from the current plan, then call ExitPlanMode again.")
            exit 2
        }
    }

    # Gate passed. The hook is the sole opener of the plan HTML — opening here is
    # deterministic (a model can forget Start-Process; the hook can't). Opening must
    # never block approval, so swallow any failure.
    try { Start-Process -FilePath $htmlPath | Out-Null } catch {}

    exit 0
}
catch {
    # Never block real work because the gate itself errored.
    exit 0
}
