#!/usr/bin/env bash
# Self-check for jev.sh: argument validation, the never-block fallbacks, and
# response parsing against a stubbed curl. No network calls are made.
set -euo pipefail
cd "$(dirname "$0")"

fail=0
check() { # desc, expected substring, actual
  if [[ "$3" == *"$2"* ]]; then echo "ok: $1"; else echo "FAIL: $1 (wanted '$2', got '$3')"; fail=1; fi
}
assert_exit1() {
  if "${@:2}" >/dev/null 2>&1; then echo "FAIL: $1 (expected exit 1)"; fail=1; else echo "ok: $1"; fi
}

# Jev runs only in a repo that opted in, so the checks run from a folder that did.
jev="$PWD/jev.sh"
repo="$(mktemp -d)"; touch "$repo/.jev-enabled"; cd "$repo"

assert_exit1 "no subcommand shows usage" "$jev"
assert_exit1 "unknown subcommand rejected" "$jev" nope
assert_exit1 "loop-guard without files rejected" "$jev" loop-guard

out="$("$jev" loop-guard /nope /nope)"
check "loop-guard with a missing round is UNAVAILABLE, exit 0" "UNAVAILABLE (a round's findings file is missing)" "$out"

out="$(TYPESAFE_API_KEY= "$jev" triage <<<'diff --git a/x b/x')"
check "missing key is UNAVAILABLE, exit 0" "UNAVAILABLE (TYPESAFE_API_KEY is not set)" "$out"

out="$(TYPESAFE_API_KEY=x "$jev" triage </dev/null)"
check "empty input is UNAVAILABLE" "UNAVAILABLE (empty input)" "$out"

# Stub curl on PATH to return canned responses.
stub="$(mktemp -d)"; trap 'rm -rf "$stub" "$repo"' EXIT
cat >"$stub/curl" <<'EOS'
#!/usr/bin/env bash
cat >/dev/null
if [[ -n "${STUB_CALLED:-}" ]]; then touch "$STUB_CALLED"; fi
if [[ -n "${STUB_FAIL:-}" ]]; then echo "HTTP 401" >&2; exit 22; fi
cat "$STUB_BODY"
EOS
chmod +x "$stub/curl"

echo '{"model":"jev-1","answers":{"security_surface":{"type":"noul","noul":0.91},"contract_change":{"type":"noul","noul":0.10},"untested_logic":{"type":"noul","noul":0.60},"mixed_concerns":{"type":"noul","noul":0.05}},"usage":{"input_tokens":1,"output_tokens":0}}' >"$stub/triage.json"
out="$(PATH="$stub:$PATH" STUB_BODY="$stub/triage.json" TYPESAFE_API_KEY=x "$jev" triage <<<'diff')"
check "triage flags a high noul" "security_surface: 0.91 FLAG" "$out"
check "triage keeps a low noul ok" "contract_change: 0.10 ok" "$out"
check "threshold is inclusive" "untested_logic: 0.60 FLAG" "$out"
check "triage verdict counts flags" "JEV VERDICT: ATTENTION (2)" "$out"

echo '{"answers":{"repeated_findings":{"type":"noul","noul":0.95},"oscillating":{"type":"noul","noul":0.1}}}' >"$stub/loop.json"
printf 'a\n' >"$stub/prev.md"; printf 'a\n' >"$stub/cur.md"
out="$(PATH="$stub:$PATH" STUB_BODY="$stub/loop.json" TYPESAFE_API_KEY=x "$jev" loop-guard "$stub/prev.md" "$stub/cur.md")"
check "loop-guard reports STALLED" "JEV VERDICT: STALLED" "$out"

echo '{"answers":{"untestable_criteria":{"type":"noul","noul":0.02}}}' >"$stub/spec.json"
out="$(PATH="$stub:$PATH" STUB_BODY="$stub/spec.json" TYPESAFE_API_KEY=x "$jev" spec-check <<<'# Spec')"
check "spec-check with no flags" "JEV VERDICT: NO SIGNALS" "$out"

out="$(PATH="$stub:$PATH" STUB_FAIL=1 STUB_BODY=/dev/null TYPESAFE_API_KEY=x "$jev" triage <<<'diff')"
check "HTTP failure is UNAVAILABLE, exit 0" "UNAVAILABLE (request failed" "$out"

echo '{"oops":true}' >"$stub/bad.json"
out="$(PATH="$stub:$PATH" STUB_BODY="$stub/bad.json" TYPESAFE_API_KEY=x "$jev" triage <<<'diff')"
check "bad response shape is UNAVAILABLE" "UNAVAILABLE (unexpected response shape)" "$out"

echo '{"answers":{"a":{"type":"noul","noul":"high"}}}' >"$stub/nan.json"
out="$(PATH="$stub:$PATH" STUB_BODY="$stub/nan.json" TYPESAFE_API_KEY=x "$jev" triage <<<'diff')"
check "non-numeric answer is UNAVAILABLE" "non-numeric answer" "$out"

# Without the repo's opt-in nothing leaves the machine, even with a key set.
other="$(mktemp -d)"
out="$(cd "$other" && PATH="$stub:$PATH" STUB_CALLED="$stub/called" STUB_BODY="$stub/triage.json" TYPESAFE_API_KEY=x "$jev" triage <<<'diff')"
check "no opt-in is UNAVAILABLE" "UNAVAILABLE (not enabled for this repo" "$out"
if [[ -e "$stub/called" ]]; then echo "FAIL: no opt-in still called the API"; fail=1; else echo "ok: no opt-in makes no request"; fi
out="$(cd "$other" && PATH="$stub:$PATH" STUB_CALLED="$stub/called" TYPESAFE_API_KEY=x "$jev" loop-guard "$repo/.jev-enabled" "$repo/.jev-enabled")"
check "no opt-in stops loop-guard too" "UNAVAILABLE (not enabled for this repo" "$out"
rm -rf "$other"

exit "$fail"
