#!/usr/bin/env bash
# install_browsers.sh [--fonts] BROWSER... — the fonts and Playwright browsers a CI job needs, with
# the network retried. Run it from the directory whose node_modules holds Playwright.
#
#   bash ../scripts/ci/install_browsers.sh --fonts chromium     # docs-site: + the PDF fallback fonts
#   bash ../scripts/ci/install_browsers.sh chromium webkit      # frontend
#
# Why: on 2026-11-11 the runner could not resolve the Ubuntu mirrors for a few minutes. The bare
# `apt-get install` of the docs job exited 100 and `playwright install --with-deps` in e2e retried
# for two hours, so the pins bot's pull request (#392) went red with nothing wrong in it. A package
# the image already carries is not fetched again; every network step is tried four times, waiting
# 20, 40 and 60 seconds, each attempt bounded by APT_ATTEMPT_TIMEOUT seconds (default 600).
#
# On 2026-11-19 a slow mirror made it worse: `timeout` ended the attempt but not the `apt-get` that
# Playwright had started under sudo, so that apt-get kept the dpkg lock and every retry failed at
# once with "Could not get lock /var/lib/dpkg/lock-frontend" (#434). So apt itself now waits for the
# lock and retries the mirrors (an apt.conf.d drop-in, which the apt-get Playwright runs reads too),
# each attempt first waits for any apt or dpkg still running, and the system packages
# (`install-deps`) are retried apart from the browser download (`install`).
#
# --fonts installs the fallback fonts a wiki PDF may embed (scripts/check-pdf.mjs allows exactly
# these beside Sant Lipi and Source Serif), by name rather than left to the runner image.
set -euo pipefail

fonts=0
if [ "${1:-}" = "--fonts" ]; then fonts=1; shift; fi
[ "$#" -gt 0 ] || { echo "usage: install_browsers.sh [--fonts] <browser>..." >&2; exit 2; }
ATTEMPT_TIMEOUT="${APT_ATTEMPT_TIMEOUT:-600}"
APT=(sudo apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30)

# apt waits up to 5 min for the dpkg lock and retries each mirror, also inside Playwright's apt-get
printf '%s\n' 'DPkg::Lock::Timeout "300";' 'Acquire::Retries "5";' \
  'Acquire::http::Timeout "30";' 'Acquire::https::Timeout "30";' \
  | sudo tee /etc/apt/apt.conf.d/80sggs-ci > /dev/null

# wait (up to 10 min) for apt or dpkg left running by the image or by an attempt `timeout` ended
wait_for_apt() {
  local waited=0
  while pgrep -x 'apt-get|apt|dpkg|unattended-upgr' > /dev/null; do
    if [ "$waited" -ge 600 ]; then echo "::warning::apt/dpkg still running after ${waited} s"; return 0; fi
    [ "$waited" = 0 ] && echo "waiting for a running apt/dpkg to finish"
    sleep 10; waited=$((waited + 10))
  done
}

retry() {
  local n=1
  wait_for_apt
  until timeout "$ATTEMPT_TIMEOUT" "$@"; do
    if [ "$n" -ge 4 ]; then echo "::error::failed after $n attempts: $*"; return 1; fi
    echo "::warning::attempt $n failed: $* (retrying in $((n * 20)) s)"
    sleep $((n * 20))
    wait_for_apt
    n=$((n + 1))
  done
}

if [ "$fonts" = 1 ]; then
  missing=()
  for p in fonts-dejavu-core fonts-liberation fonts-freefont-ttf fonts-noto-color-emoji; do
    dpkg -s "$p" > /dev/null 2>&1 || missing+=("$p")
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    # `apt-get update` exits 0 when a mirror cannot be reached, so the install decides the retry
    retry bash -c "${APT[*]} update -qq && ${APT[*]} install -y --no-install-recommends ${missing[*]}"
  else
    echo "fonts already installed"
  fi
fi

retry npx playwright install-deps "$@"   # system packages (apt)
retry npx playwright install "$@"        # the browsers themselves (Playwright's CDN)
