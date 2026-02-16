# Testing Guide - Monitoring Health Checks

This guide helps you verify that the monitoring health checks are now working correctly.

## Quick Test: Invalid Domain

This test verifies that health checks actually execute and update service status.

### Prerequisites
- Application is running (via Docker, local dev, or deployed)
- You have access to the admin panel
- You can make HTTP requests (curl, Postman, or browser)

### Test Steps

#### 1. Create or Edit a Service with Monitoring

1. Go to **Admin Panel** → **Services**
2. Create a new service or edit an existing one
3. Configure monitoring:
   ```
   ✓ Enable Automatic Monitoring: [checked]
   Monitor URL: https://this-domain-definitely-does-not-exist-12345.com
   HTTP Method: GET
   Check Interval: 60 seconds
   Timeout: 10 seconds
   Expected HTTP Status Code: 200
   Failure Threshold: 1  (set to 1 for quick testing)
   ```
4. Save the service
5. Note the service ID (visible in the URL or admin panel)

#### 2. Verify Initial State

- Service status should be "Operational" (default)
- Last Checked At: should be empty
- Last Check Status: should be empty
- Consecutive Failures: should be 0

#### 3. Trigger Health Check (Option A: Specific Service)

Using curl:
```bash
curl -X POST http://localhost:3000/api/monitoring/check \
  -H "Content-Type: application/json" \
  -d '{"serviceId": 123}'  # Replace 123 with your service ID
```

Using Postman/Thunder Client:
- Method: POST
- URL: `http://localhost:3000/api/monitoring/check`
- Body (JSON): `{"serviceId": 123}`

Expected Response:
```json
{
  "message": "Health check completed",
  "serviceId": 123,
  "serviceName": "Your Service Name"
}
```

#### 4. Trigger Health Check (Option B: All Services)

Using curl:
```bash
curl -X GET http://localhost:3000/api/monitoring/check
```

Expected Response:
```json
{
  "message": "Monitoring checks completed",
  "jobId": "clx..."
}
```

#### 5. Verify Results

Go back to the admin panel and refresh the service edit page.

**Expected Changes:**
- ✅ **Status**: Should now be "Major Outage" (or "Degraded" if threshold > 1)
- ✅ **Last Checked At**: Should show current timestamp
- ✅ **Last Check Status**: Should show "failed"
- ✅ **Consecutive Failures**: Should be 1

**If you see these changes, the fix is working! ✅**

### Test 2: Valid Domain (Recovery)

Now test that a valid domain marks the service as operational:

1. Edit the same service
2. Change the Monitor URL to a valid URL:
   ```
   Monitor URL: https://www.google.com
   ```
3. Save the service
4. Trigger the health check again (POST or GET)
5. Verify:
   - ✅ Status: "Operational"
   - ✅ Last Check Status: "success"
   - ✅ Consecutive Failures: 0

### Test 3: Automatic Scheduling

Test that the scheduled checks work with intervals:

1. Keep the valid URL (e.g., google.com)
2. Set Check Interval to 30 seconds (minimum)
3. Call `GET /api/monitoring/check` twice:
   - First call: Should check the service
   - Immediately call again: Should skip (too soon)
   - Wait 30 seconds, call again: Should check again

The response will show:
```json
{
  "tasksQueued": 1,
  "tasksSkipped": 0,
  "queuedServices": ["Your Service"],
  "skippedServices": []
}
```

## Troubleshooting

### Issue: Service still shows "Operational" after check

**Check 1:** Verify monitoring is enabled
- In admin panel, check "Enable Automatic Monitoring" is checked

**Check 2:** Verify URL is configured
- Monitor URL field should not be empty

**Check 3:** Check application logs
```bash
# Docker
docker compose logs -f app

# Local dev
# Check console output
```

Look for errors like:
- "Monitoring is not enabled for this service"
- "No monitoring URL configured"
- Health check errors

**Check 4:** Verify the API response
- API should return "Health check completed" (not "queued")
- If it returns "queued", the fix wasn't applied

### Issue: Last Checked At doesn't update

This suggests the job isn't running. Check:
1. Application logs for job execution errors
2. Database connection (jobs table should have records)
3. Service ID is correct in the POST request

### Issue: Status doesn't change after first failure

**Expected Behavior:** With default failure threshold of 3:
- 1 failure: Status becomes "Degraded Performance"
- 3 failures: Status becomes "Major Outage"

To test immediate changes, set Failure Threshold to 1.

## Expected Behavior Summary

| Scenario | Expected Status | Notes |
|----------|----------------|-------|
| Invalid URL, 1st check | Degraded | If threshold > 1 |
| Invalid URL, 1st check | Major Outage | If threshold = 1 |
| Invalid URL, 3rd check | Major Outage | Default threshold |
| Valid URL after failures | Operational | Resets on success |
| Valid URL, always | Operational | No failures |

## Logs to Check

If issues persist, check these logs:

**Health Check Execution:**
```
[timestamp] Performing health check for service: [name]
[timestamp] Health check result: success/failed
[timestamp] Consecutive failures: [count]
[timestamp] Status changed: [old] → [new]
```

**Job Queue:**
```
[timestamp] Job queued: checkServiceHealth
[timestamp] Job started: checkServiceHealth
[timestamp] Job completed: checkServiceHealth
```

## Success Criteria

✅ Health checks execute immediately when API is called
✅ Invalid URLs cause status to change from Operational
✅ Valid URLs cause status to return to Operational
✅ Last Checked At timestamp updates on each check
✅ Consecutive failures count correctly
✅ Status respects failure threshold configuration

If all criteria pass, monitoring is working correctly!
