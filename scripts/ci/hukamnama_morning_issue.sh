#!/usr/bin/env bash
# Open (or comment on) the day's issue for a failed morning check, then fail the job.
# Reads WHERE (staging|production), SITE, REPORT, GH_TOKEN and GITHUB_REPOSITORY from the environment.
set -euo pipefail
day="$(TZ=Asia/Kolkata date +%F)"
title="Hukamnama pages ($WHERE): they do not match the API on $day (Amritsar)"
fence='```'
body="Morning check at $(TZ=Asia/Kolkata date +%H:%M) IST against ${SITE}:

${fence}
${REPORT}
${fence}

If a page shows the wrong text, pause the service first (\`python -m hukamnama pause\`), then look.
Runbook: docs/process/runbooks/hukamnama-service.md"
existing="$(gh issue list --repo "$GITHUB_REPOSITORY" --state open --search "in:title \"$title\"" --json number --jq '.[0].number // empty')"
if [ -n "$existing" ]; then
  gh issue comment "$existing" --repo "$GITHUB_REPOSITORY" --body "$body"
else
  gh issue create --repo "$GITHUB_REPOSITORY" --title "$title" --body "$body"
fi
exit 1
