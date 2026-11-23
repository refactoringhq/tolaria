#!/usr/bin/env bash
# CodeScene project health gate: Hotspot and Average Code Health must meet the
# floors in .codescene-thresholds. The API sometimes answers with an HTML error
# page or a failed request (TOL-442), so unreadable replies are retried; a
# readable score below its floor fails at once, and so do replies that never
# become readable.
set -euo pipefail

thresholds_file="${CODESCENE_THRESHOLDS_FILE:-.codescene-thresholds}"
attempts="${CODESCENE_GATE_ATTEMPTS:-5}"
retry_delay="${CODESCENE_GATE_RETRY_DELAY:-15}"

if [[ -z "${CODESCENE_PAT:-}" || -z "${CODESCENE_PROJECT_ID:-}" ]]; then
  echo "CODESCENE_PAT and CODESCENE_PROJECT_ID are required." >&2
  exit 1
fi

HOTSPOT_THRESHOLD="$(awk -F= '/^HOTSPOT_THRESHOLD=/{print $2}' "$thresholds_file")"
AVERAGE_THRESHOLD="$(awk -F= '/^AVERAGE_THRESHOLD=/{print $2}' "$thresholds_file")"
export HOTSPOT_THRESHOLD AVERAGE_THRESHOLD

fetch_project() {
  curl -fsS --max-time 30 \
    -H "Authorization: Bearer ${CODESCENE_PAT}" \
    -H "Accept: application/json" \
    "https://api.codescene.io/v2/projects/${CODESCENE_PROJECT_ID}"
}

# Exit 0: scores meet the floors. Exit 1: a score is below its floor.
# Exit 3: the reply has no readable scores, so it is worth another attempt.
evaluate_scores() {
  node -e '
    let analysis;
    try {
      analysis = JSON.parse(require("node:fs").readFileSync(0, "utf8")).analysis;
    } catch {
      console.error("CodeScene API reply is not JSON");
      process.exit(3);
    }
    const hotspot = analysis?.hotspot_code_health?.now;
    const average = analysis?.code_health?.now;
    const isScore = (value) => typeof value === "number" && Number.isFinite(value);
    if (!isScore(hotspot) || !isScore(average)) {
      console.error("CodeScene API reply has no numeric Hotspot/Average scores");
      process.exit(3);
    }
    const hotspotThreshold = Number.parseFloat(process.env.HOTSPOT_THRESHOLD ?? "");
    const averageThreshold = Number.parseFloat(process.env.AVERAGE_THRESHOLD ?? "");
    if (!Number.isFinite(hotspotThreshold) || !Number.isFinite(averageThreshold)) {
      console.error("Thresholds in .codescene-thresholds are not numeric");
      process.exit(1);
    }
    console.log("Hotspot Code Health: " + hotspot.toFixed(2) + " (threshold " + hotspotThreshold.toFixed(2) + ")");
    console.log("Average Code Health: " + average.toFixed(2) + " (threshold " + averageThreshold.toFixed(2) + ")");
    if (hotspot < hotspotThreshold || average < averageThreshold) {
      console.error("CodeScene project health gate failed");
      process.exit(1);
    }
  '
}

for ((attempt = 1; attempt <= attempts; attempt++)); do
  status=0
  if response="$(fetch_project)"; then
    evaluate_scores <<< "$response" || status=$?
  else
    echo "CodeScene API request failed" >&2
    status=3
  fi

  if [[ "$status" != 3 ]]; then
    exit "$status"
  fi
  if (( attempt < attempts )); then
    echo "Retrying CodeScene API in ${retry_delay}s (attempt ${attempt}/${attempts})" >&2
    sleep "$retry_delay"
  fi
done

echo "CodeScene project health gate failed: no readable scores after ${attempts} attempts" >&2
exit 1
