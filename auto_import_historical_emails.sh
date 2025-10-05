#!/bin/bash

# Batch Email Import Runner
# This script repeatedly calls your Supabase function until all emails are imported

FUNCTION_URL="https://aqidnxizhpzehokukxdq.co/functions/v1/import-historical-emails"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxaWRueGl6aHB6ZWhva3VreGRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMzI5MzEsImV4cCI6MjA3MzgwODkzMX0.-xUWkM93Pr3ZFQuHtd0Hll0Sv3GxF9VblW-rZbLO7ek"

echo "========================================"
echo "Starting Batch Email Import"
echo "========================================"

BATCH_COUNT=0
TOTAL_IMPORTED=0
TOTAL_SKIPPED=0
TOTAL_ERRORS=0
PAGE_TOKEN=""

while true; do
  BATCH_COUNT=$((BATCH_COUNT + 1))
  echo ""
  echo "Running batch $BATCH_COUNT..."
  echo "----------------------------------------"
  
  # Build request body
  if [ -z "$PAGE_TOKEN" ]; then
    REQUEST_BODY="{}"
  else
    REQUEST_BODY="{\"pageToken\":\"$PAGE_TOKEN\"}"
  fi
  
  # Call the function
  RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
    -H "Authorization: Bearer $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "$REQUEST_BODY")
  
  # Check if response is valid JSON
  if ! echo "$RESPONSE" | jq empty 2>/dev/null; then
    echo "ERROR: Invalid JSON response"
    echo "$RESPONSE"
    exit 1
  fi
  
  # Parse response
  echo "$RESPONSE" | jq '.'
  
  # Extract values
  HAS_MORE=$(echo "$RESPONSE" | jq -r '.has_more')
  NEW_EMAILS=$(echo "$RESPONSE" | jq -r '.new_emails')
  SKIPPED=$(echo "$RESPONSE" | jq -r '.skipped')
  ERRORS=$(echo "$RESPONSE" | jq -r '.errors')
  PAGE_TOKEN=$(echo "$RESPONSE" | jq -r '.next_page_token')
  
  # Check for error response
  if [ "$NEW_EMAILS" == "null" ]; then
    echo "ERROR: Function returned an error"
    exit 1
  fi
  
  TOTAL_IMPORTED=$((TOTAL_IMPORTED + NEW_EMAILS))
  TOTAL_SKIPPED=$((TOTAL_SKIPPED + SKIPPED))
  TOTAL_ERRORS=$((TOTAL_ERRORS + ERRORS))
  
  echo ""
  echo "Batch $BATCH_COUNT complete:"
  echo "  - New emails: $NEW_EMAILS"
  echo "  - Skipped: $SKIPPED"
  echo "  - Errors: $ERRORS"
  echo ""
  echo "Running totals:"
  echo "  - Total imported: $TOTAL_IMPORTED"
  echo "  - Total skipped: $TOTAL_SKIPPED"
  echo "  - Total errors: $TOTAL_ERRORS"
  
  # If no more emails, we're done
  if [ "$HAS_MORE" != "true" ] || [ "$PAGE_TOKEN" == "null" ]; then
    echo ""
    echo "========================================"
    echo "✓ ALL EMAILS IMPORTED!"
    echo "========================================"
    echo "Total batches run: $BATCH_COUNT"
    echo "Total emails imported: $TOTAL_IMPORTED"
    echo "Total emails skipped: $TOTAL_SKIPPED"
    echo "Total errors: $TOTAL_ERRORS"
    echo "========================================"
    break
  fi
  
  # Wait a bit before next batch (to avoid overwhelming the system)
  echo ""
  echo "Waiting 5 seconds before next batch..."
  sleep 5
done
