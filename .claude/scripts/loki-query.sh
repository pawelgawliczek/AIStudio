#!/bin/bash
# Loki query helper script for Claude Code
# Usage: loki-query.sh '<query>' [limit] [minutes_back]
# Example: loki-query.sh '{compose_service="backend"} |~ "error"' 50 30

QUERY="${1:?Usage: loki-query.sh '<query>' [limit] [minutes_back]}"
LIMIT="${2:-20}"
MINUTES="${3:-30}"

# Calculate time range
END=$(date +%s)000000000
START=$(echo "$(date +%s) - ($MINUTES * 60)" | bc)000000000

# URL encode the query
ENCODED_QUERY=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$QUERY'''))")

# Execute query
curl -s -u "vibestudio:a0b961abd748e5ebe29fb074ab9f498e69ddf87028d33855" \
  "https://vibestudio.example.com/loki/loki/api/v1/query_range?query=${ENCODED_QUERY}&limit=${LIMIT}&start=${START}&end=${END}" \
  | jq -r '.data.result[0].values[][1]' 2>/dev/null
