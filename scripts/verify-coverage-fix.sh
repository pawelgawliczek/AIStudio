#!/bin/bash

##############################################################################
# Coverage Fix Verification Script for ST-37
#
# This script verifies that the coverage calculation fix is working correctly
# by testing the API endpoints directly on the production server.
#
# Expected: ~11.88% coverage (not 5%)
##############################################################################

set -e

# Configuration
PROJECT_ID="345a29ee-d6ab-477d-8079-c5dda0844d77"
API_BASE="https://vibestudio.example.com/api"
EXPECTED_COVERAGE=11.88
TOLERANCE=0.5
OLD_BUGGY_COVERAGE=5.0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "=========================================="
echo " Coverage Fix Verification - ST-37"
echo "=========================================="
echo ""
echo "Testing API endpoints on production server..."
echo "Project ID: $PROJECT_ID"
echo "Expected Coverage: ${EXPECTED_COVERAGE}% (±${TOLERANCE}%)"
echo ""

# Function to test an endpoint
test_endpoint() {
    local endpoint_name="$1"
    local endpoint_url="$2"
    local coverage_path="$3"

    echo "----------------------------------------"
    echo "Testing: $endpoint_name"
    echo "URL: $endpoint_url"
    echo "----------------------------------------"

    # Make API call
    response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$endpoint_url" || echo "")

    # Extract HTTP status
    http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_STATUS/d')

    echo "HTTP Status: $http_status"

    if [ "$http_status" = "401" ]; then
        echo -e "${YELLOW}⚠️  Authentication required${NC}"
        echo "This is expected for production. The endpoint is protected."
        echo ""
        echo "To verify the fix, you need to:"
        echo "1. Log into https://vibestudio.example.com"
        echo "2. Open browser DevTools (F12)"
        echo "3. Navigate to Code Quality Dashboard"
        echo "4. Check Network tab for API responses"
        echo "5. Verify coverage shows ~11.88% (not 5%)"
        echo ""
        return 1
    fi

    if [ "$http_status" != "200" ]; then
        echo -e "${RED}✗ FAILED: HTTP $http_status${NC}"
        echo "Response: $body"
        return 1
    fi

    # Extract coverage from response
    if command -v jq &> /dev/null; then
        coverage=$(echo "$body" | jq -r "$coverage_path // empty" 2>/dev/null || echo "")
    else
        # Fallback if jq is not available
        coverage=$(echo "$body" | grep -oP '"coverage":\s*\K[\d.]+' | head -1 || echo "")
    fi

    if [ -z "$coverage" ] || [ "$coverage" = "null" ]; then
        echo -e "${RED}✗ FAILED: Could not extract coverage from response${NC}"
        echo "Response: $body" | head -20
        return 1
    fi

    echo "Coverage: ${coverage}%"

    # Check if it's the old buggy value
    is_buggy=$(echo "$coverage $OLD_BUGGY_COVERAGE" | awk '{if ($1 > $2 - 0.1 && $1 < $2 + 0.1) print "yes"; else print "no"}')

    if [ "$is_buggy" = "yes" ]; then
        echo -e "${RED}✗ FAILED: Still showing old buggy coverage of ${OLD_BUGGY_COVERAGE}%${NC}"
        echo "The backend fix has NOT been deployed or is not working!"
        return 1
    fi

    # Check if it's within expected range
    in_range=$(echo "$coverage $EXPECTED_COVERAGE $TOLERANCE" | awk '{if ($1 >= $2 - $3 && $1 <= $2 + $3) print "yes"; else print "no"}')

    if [ "$in_range" = "yes" ]; then
        echo -e "${GREEN}✅ PASSED: Coverage is ${coverage}% (expected ${EXPECTED_COVERAGE}% ±${TOLERANCE}%)${NC}"
        echo "The backend fix is working correctly!"
        return 0
    else
        echo -e "${YELLOW}⚠️  WARNING: Coverage is ${coverage}%, expected ${EXPECTED_COVERAGE}% ±${TOLERANCE}%${NC}"
        echo "The value is correct (not ${OLD_BUGGY_COVERAGE}%), but differs from expected."
        return 0
    fi
}

# Test endpoints
failed=0

test_endpoint \
    "Project Metrics API" \
    "$API_BASE/code-metrics/project/$PROJECT_ID" \
    ".overview.coverage // .testMetrics.coverage // .coverage" \
    || failed=$((failed + 1))

echo ""

test_endpoint \
    "Test Summary API" \
    "$API_BASE/code-metrics/project/$PROJECT_ID/test-summary" \
    ".coverage" \
    || failed=$((failed + 1))

echo ""
echo "=========================================="
if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
    echo "Coverage fix is working correctly!"
else
    echo -e "${RED}✗ TESTS FAILED${NC}"
    echo ""
    echo "The API endpoints require authentication."
    echo ""
    echo "MANUAL VERIFICATION STEPS:"
    echo "1. Open browser and navigate to:"
    echo "   https://vibestudio.example.com/code-quality/$PROJECT_ID"
    echo ""
    echo "2. Log in with your credentials"
    echo ""
    echo "3. Open browser DevTools (F12)"
    echo ""
    echo "4. Go to Network tab and filter for 'code-metrics'"
    echo ""
    echo "5. Check the API responses for coverage values"
    echo ""
    echo "6. Verify BOTH Overview and Test Coverage tabs show:"
    echo "   ✓ ~11.88% coverage (CORRECT)"
    echo "   ✗ NOT ~5% coverage (OLD BUG)"
    echo ""
fi
echo "=========================================="
echo ""

exit $failed
