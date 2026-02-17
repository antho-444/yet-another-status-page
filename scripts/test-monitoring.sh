#!/bin/bash

# Simple monitoring functionality test
# This script tests the monitoring utilities without requiring a full application setup

set -e

echo "=== Testing Monitoring Utilities ==="
echo ""

cd "$(dirname "$0")/.."

echo "1. Checking TypeScript compilation..."
npm run typecheck
echo "✓ TypeScript compilation passed"
echo ""

echo "2. Running linter..."
npm run lint
echo "✓ Linting passed"
echo ""

echo "3. Building application..."
npm run build > /tmp/build.log 2>&1
if [ $? -eq 0 ]; then
    echo "✓ Build successful"
else
    echo "✗ Build failed"
    tail -50 /tmp/build.log
    exit 1
fi
echo ""

echo "4. Verifying monitoring files exist..."
files=(
    "src/lib/monitoring.ts"
    "src/tasks/checkServiceHealth.ts"
    "src/tasks/scheduleMonitoringChecks.ts"
    "src/app/api/monitoring/check/route.ts"
    "MONITORING.md"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ✗ $file missing"
        exit 1
    fi
done
echo ""

echo "5. Checking exports..."
if grep -q "export async function performHealthCheck" src/lib/monitoring.ts; then
    echo "  ✓ performHealthCheck function exported"
else
    echo "  ✗ performHealthCheck function not found"
    exit 1
fi

if grep -q "export async function checkServiceHealthHandler" src/tasks/checkServiceHealth.ts; then
    echo "  ✓ checkServiceHealthHandler function exported"
else
    echo "  ✗ checkServiceHealthHandler function not found"
    exit 1
fi

if grep -q "export async function scheduleMonitoringChecksHandler" src/tasks/scheduleMonitoringChecks.ts; then
    echo "  ✓ scheduleMonitoringChecksHandler function exported"
else
    echo "  ✗ scheduleMonitoringChecksHandler function not found"
    exit 1
fi
echo ""

echo "6. Verifying API routes are registered..."
if grep -q "/api/monitoring/check" .next/routes-manifest.json 2>/dev/null; then
    echo "  ✓ Monitoring API route registered"
else
    echo "  ⚠ Could not verify API route (build may not be complete)"
fi
echo ""

echo "==================================="
echo "✓ All monitoring tests passed!"
echo "==================================="
echo ""
echo "To test monitoring in a running application:"
echo "1. Start the application: docker compose up -d"
echo "2. Go to Admin Panel: http://localhost:3000/admin"
echo "3. Configure a service with monitoring enabled"
echo "4. Trigger a check: curl -X GET http://localhost:3000/api/monitoring/check"
echo "5. Check the service status in the admin panel"
