#!/bin/bash
# Verification script for TypeScript Strict Mode migration (ST-283)
# Run this script after each phase to verify progress

set -e

echo "=========================================="
echo "TypeScript Strict Mode Verification"
echo "=========================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
OVERALL_STATUS=0

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}"
    else
        echo -e "${RED}✗ FAIL${NC}"
        OVERALL_STATUS=1
    fi
}

# 1. Count 'any' usage
echo "1. Checking 'any' usage counts..."
echo "   Backend:"
BACKEND_ANY_COUNT=$(grep -r ": any\|as any" backend/src --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')
echo "   - Current: $BACKEND_ANY_COUNT occurrences"

echo "   Frontend:"
FRONTEND_ANY_COUNT=$(grep -r ": any\|as any" frontend/src --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
echo "   - Current: $FRONTEND_ANY_COUNT occurrences"

echo "   Total: $((BACKEND_ANY_COUNT + FRONTEND_ANY_COUNT)) occurrences"
echo ""

# 2. TypeScript compilation check
echo "2. Running TypeScript compilation (npm run typecheck)..."
if npm run typecheck > /tmp/typecheck.log 2>&1; then
    echo -e "   ${GREEN}✓ TypeScript compilation successful${NC}"
else
    echo -e "   ${RED}✗ TypeScript compilation failed${NC}"
    BACKEND_TS_ERRORS=$(grep -c "error TS" /tmp/typecheck.log 2>/dev/null || echo "0")
    echo "   - Total TypeScript errors: $BACKEND_TS_ERRORS"
    echo ""
    echo "   First 10 errors:"
    grep "error TS" /tmp/typecheck.log 2>/dev/null | head -10 || echo "   No errors found in log"
    OVERALL_STATUS=1
fi
echo ""

# 3. ESLint check
echo "3. Running ESLint (npm run lint)..."
if npm run lint > /tmp/lint.log 2>&1; then
    echo -e "   ${GREEN}✓ ESLint passed with no errors${NC}"
else
    LINT_ERRORS=$(grep -c "error" /tmp/lint.log 2>/dev/null || echo "0")
    LINT_WARNINGS=$(grep -c "warning" /tmp/lint.log 2>/dev/null || echo "0")

    if [ "$LINT_ERRORS" -eq 0 ]; then
        echo -e "   ${GREEN}✓ ESLint passed (0 errors, $LINT_WARNINGS warnings)${NC}"
    else
        echo -e "   ${RED}✗ ESLint failed with $LINT_ERRORS errors${NC}"
        echo "   - Warnings: $LINT_WARNINGS"
        OVERALL_STATUS=1
    fi
fi
echo ""

# 4. Unit tests
echo "4. Running unit tests (npm run test)..."
if npm run test -- --passWithNoTests --run > /tmp/test.log 2>&1; then
    echo -e "   ${GREEN}✓ All tests passed${NC}"
    TEST_COUNT=$(grep -o "[0-9]* passed" /tmp/test.log 2>/dev/null | head -1 || echo "0 passed")
    echo "   - Tests: $TEST_COUNT"
else
    echo -e "   ${RED}✗ Tests failed${NC}"
    FAILED_TESTS=$(grep -c "FAIL" /tmp/test.log 2>/dev/null || echo "0")
    echo "   - Failed tests: $FAILED_TESTS"
    echo ""
    echo "   Test failures:"
    grep "FAIL" /tmp/test.log 2>/dev/null | head -5 || echo "   No failure details in log"
    OVERALL_STATUS=1
fi
echo ""

# 5. Build verification
echo "5. Running build verification (npm run build)..."
if npm run build > /tmp/build.log 2>&1; then
    echo -e "   ${GREEN}✓ Build successful${NC}"
else
    echo -e "   ${RED}✗ Build failed${NC}"
    echo "   Last 10 lines of build output:"
    tail -10 /tmp/build.log
    OVERALL_STATUS=1
fi
echo ""

# Summary
echo "=========================================="
echo "SUMMARY"
echo "=========================================="
echo "Any usage: Backend=$BACKEND_ANY_COUNT, Frontend=$FRONTEND_ANY_COUNT"

if [ $OVERALL_STATUS -eq 0 ]; then
    echo -e "${GREEN}✓ All verification checks passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some verification checks failed${NC}"
    echo ""
    echo "Logs saved to:"
    echo "  - /tmp/typecheck.log"
    echo "  - /tmp/lint.log"
    echo "  - /tmp/test.log"
    echo "  - /tmp/build.log"
    exit 1
fi
