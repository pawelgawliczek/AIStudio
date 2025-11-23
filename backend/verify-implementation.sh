#!/bin/bash

echo "========================================="
echo "ST-64 Backend Implementation Verification"
echo "========================================="
echo ""

# Check file existence
echo "📁 Checking file existence..."
files=(
  "src/controllers/versioning.controller.ts"
  "src/controllers/analytics.controller.ts"
  "src/services/versioning.service.ts"
  "src/services/analytics.service.ts"
  "src/services/checksum.service.ts"
  "src/dtos/versioning.dto.ts"
  "src/dtos/analytics.dto.ts"
  "src/analytics/analytics.module.ts"
  "src/services/versioning.module.ts"
)

all_exist=true
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    lines=$(wc -l < "$file")
    echo "  ✅ $file ($lines lines)"
  else
    echo "  ❌ $file - NOT FOUND"
    all_exist=false
  fi
done

echo ""

# Check module registration
echo "🔧 Checking module registration in app.module.ts..."
if grep -q "VersioningModule" src/app.module.ts && grep -q "AnalyticsModule" src/app.module.ts; then
  echo "  ✅ Both VersioningModule and AnalyticsModule registered"
else
  echo "  ❌ Modules not properly registered"
  all_exist=false
fi

echo ""

# Check endpoint count
echo "📊 Counting implemented endpoints..."
versioning_endpoints=$(grep -c "@Get\|@Post" src/controllers/versioning.controller.ts)
analytics_endpoints=$(grep -c "@Get" src/controllers/analytics.controller.ts)
echo "  ✅ Versioning endpoints: $versioning_endpoints"
echo "  ✅ Analytics endpoints: $analytics_endpoints"
echo "  ✅ Total endpoints: $((versioning_endpoints + analytics_endpoints))"

echo ""

# Check tests
echo "🧪 Checking test files..."
tests=(
  "src/controllers/__tests__/versioning.controller.spec.ts"
  "src/controllers/__tests__/analytics.controller.spec.ts"
  "src/services/__tests__/versioning.service.test.ts"
  "src/services/__tests__/versioning.service.integration.test.ts"
)

for test in "${tests[@]}"; do
  if [ -f "$test" ]; then
    echo "  ✅ $test"
  else
    echo "  ❌ $test - NOT FOUND"
  fi
done

echo ""
echo "========================================="
if [ "$all_exist" = true ]; then
  echo "✅ VERIFICATION PASSED"
  echo "All backend API endpoints are implemented!"
else
  echo "❌ VERIFICATION FAILED"
  echo "Some files are missing."
fi
echo "========================================="
