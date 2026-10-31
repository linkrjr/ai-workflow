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

assert_exit1 "no subcommand shows usage" ./jev.sh
assert_exit1 "unknown subcommand rejected" ./jev.sh nope
assert_exit1 "loop-guard without files rejected" ./jev.sh loop-guard
assert_exit1 "loop-guard with unreadable file rejected" ./jev.sh loop-guard /nope /nope

out="$(TYPESAFE_API_KEY= ./jev.sh triage <<<'diff --git a/x b/x')"
check "missing key is UNAVAILABLE, exit 0" "UNAVAILABLE (TYPESAFE_API_KEY is not set)" "$out"

out="$(TYPESAFE_API_KEY=x ./jev.sh triage </dev/null)"
check "empty input is UNAVAILABLE" "UNAVAILABLE (empty input)" "$out"

# Stub curl on PATH to return canned responses.
stub="$(mktemp -d)"; trap 'rm -rf "$stub"' EXIT
cat >"$stub/curl" <<'EOS'
#!/usr/bin/env bash
cat >/dev/null
if [[ -n "${STUB_FAIL:-}" ]]; then echo "HTTP 401" >&2; exit 22; fi
cat "$STUB_BODY"
EOS
chmod +x "$stub/curl"

echo '{"model":"jev-1","answers":{"security_surface":{"type":"noul","noul":0.91},"contract_change":{"type":"noul","noul":0.10},"untested_logic":{"type":"noul","noul":0.60},"mixed_concerns":{"type":"noul","noul":0.05}},"usage":{"input_tokens":1,"output_tokens":0}}' >"$stub/triage.json"
out="$(PATH="$stub:$PATH" STUB_BODY="$stub/triage.json" TYPESAFE_API_KEY=x ./jev.sh triage <<<'diff')"
check "triage flags a high noul" "security_surface: 0.91 FLAG" "$out"
check "triage keeps a low noul ok" "contract_change: 0.10 ok" "$out"
check "threshold is inclusive" "untested_logic: 0.60 FLAG" "$out"
check "triage verdict counts flags" "JEV VERDICT: ATTENTION (2)" "$out"

echo '{"answers":{"repeated_findings":{"type":"noul","noul":0.95},"oscillating":{"type":"noul","noul":0.1}}}' >"$stub/loop.json"
printf 'a\n' >"$stub/prev.md"; printf 'a\n' >"$stub/cur.md"
out="$(PATH="$stub:$PATH" STUB_BODY="$stub/loop.json" TYPESAFE_API_KEY=x ./jev.sh loop-guard "$stub/prev.md" "$stub/cur.md")"
check "loop-guard reports STALLED" "JEV VERDICT: STALLED" "$out"

echo '{"answers":{"untestable_criteria":{"type":"noul","noul":0.02}}}' >"$stub/spec.json"
out="$(PATH="$stub:$PATH" STUB_BODY="$stub/spec.json" TYPESAFE_API_KEY=x ./jev.sh spec-check <<<'# Spec')"
check "spec-check with no flags" "JEV VERDICT: NO SIGNALS" "$out"

out="$(PATH="$stub:$PATH" STUB_FAIL=1 STUB_BODY=/dev/null TYPESAFE_API_KEY=x ./jev.sh triage <<<'diff')"
check "HTTP failure is UNAVAILABLE, exit 0" "UNAVAILABLE (request failed" "$out"

echo '{"oops":true}' >"$stub/bad.json"
out="$(PATH="$stub:$PATH" STUB_BODY="$stub/bad.json" TYPESAFE_API_KEY=x ./jev.sh triage <<<'diff')"
check "bad response shape is UNAVAILABLE" "UNAVAILABLE (unexpected response shape)" "$out"

echo '{"answers":{"a":{"type":"noul","noul":"high"}}}' >"$stub/nan.json"
out="$(PATH="$stub:$PATH" STUB_BODY="$stub/nan.json" TYPESAFE_API_KEY=x ./jev.sh triage <<<'diff')"
check "non-numeric answer is UNAVAILABLE" "non-numeric answer" "$out"

exit "$fail"
