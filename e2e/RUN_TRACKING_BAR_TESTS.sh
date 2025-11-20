#!/bin/bash

# Run Global Workflow Tracking Bar E2E Tests
# Story: ST-28

echo "========================================="
echo "Global Workflow Tracking Bar E2E Tests"
echo "Story: ST-28"
echo "========================================="
echo ""

# Check if Playwright is installed
if ! command -v npx &> /dev/null; then
    echo "Error: npx not found. Please install Node.js and npm."
    exit 1
fi

# Check if backend is running
if ! curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "Warning: Backend server may not be running on port 3000"
    echo "Make sure backend is started before running tests"
fi

# Check if frontend is running
if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "Warning: Frontend server may not be running on port 5173"
    echo "Make sure frontend is started before running tests"
fi

echo ""
echo "Running Playwright E2E tests..."
echo ""

# Run the tests
npx playwright test e2e/08-global-workflow-tracking-bar.spec.ts "$@"

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "========================================="
    echo "✓ All tests passed!"
    echo "========================================="
else
    echo ""
    echo "========================================="
    echo "✗ Some tests failed. Check output above."
    echo "========================================="
    exit 1
fi
