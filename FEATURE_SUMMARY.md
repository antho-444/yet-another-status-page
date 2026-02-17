# Automatic Service Monitoring - Feature Summary

## What Was Implemented

This PR adds automatic service monitoring capabilities to Yet Another Status Page, allowing services to be automatically checked and their status updated when they go down.

## Key Features

### 1. Service Configuration (Admin Panel)

When editing a service in the admin panel, you'll now see a **"Monitoring Configuration"** section with the following fields:

```
Monitoring Configuration
├─ Enable Automatic Monitoring [checkbox]
├─ Monitor URL: https://api.example.com/health
├─ HTTP Method: [GET|HEAD|POST]
├─ Check Interval (seconds): 60 (min: 30, max: 3600)
├─ Timeout (seconds): 10 (min: 1, max: 60)
├─ Expected HTTP Status Code: 200
├─ Failure Threshold: 3 (min: 1, max: 10)
├─ Last Checked At: 2026-02-16T15:45:00.000Z (read-only)
├─ Last Check Status: Success (read-only)
└─ Consecutive Failures: 0 (read-only)
```

### 2. Automatic Status Updates

The system automatically updates service status based on health check results:

| Consecutive Failures | Service Status           |
|---------------------|-------------------------|
| 0                   | ✅ Operational          |
| 1-2 (below threshold)| ⚠️ Degraded Performance |
| 3+ (at threshold)    | 🔴 Major Outage         |

### 3. Background Processing

Health checks run as background jobs in Payload's job queue:
- Non-blocking HTTP/HTTPS requests
- Configurable timeouts
- Automatic retries on transient failures
- Response time tracking

### 4. API Endpoints

**GET /api/monitoring/check**
- Triggers monitoring for all enabled services
- Should be called periodically (e.g., via cron)

**POST /api/monitoring/check**
- Triggers monitoring for a specific service
- Body: `{ "serviceId": 123 }`

### 5. Setup Options

Multiple ways to trigger periodic monitoring:

#### Option A: Cron Job
```bash
* * * * * curl -s http://status.example.com/api/monitoring/check
```

#### Option B: Docker Compose
Add a monitoring-cron service to your docker-compose.yml (example provided)

#### Option C: GitHub Actions
Run monitoring checks on a schedule using GitHub Actions (example provided)

#### Option D: External Service
Use any monitoring/cron service (UptimeRobot, Better Uptime, etc.)

## Files Changed

### New Files
1. `src/lib/monitoring.ts` - Health check utilities
2. `src/tasks/checkServiceHealth.ts` - Individual service health check handler
3. `src/tasks/scheduleMonitoringChecks.ts` - Batch scheduling handler
4. `src/app/api/monitoring/check/route.ts` - API endpoints
5. `MONITORING.md` - Comprehensive documentation
6. `scripts/setup-monitoring-cron.sh` - Interactive cron setup script
7. `scripts/test-monitoring.sh` - Test script
8. `docker-compose.monitoring-example.yml` - Docker example
9. `examples/github-actions-monitoring.yml` - GitHub Actions example

### Modified Files
1. `src/collections/Services.ts` - Added monitoring configuration fields
2. `payload.config.ts` - Registered new job handlers
3. `README.md` - Added monitoring feature to features list
4. `src/payload-types.ts` - Generated types (auto-updated)

## Usage Example

### Step 1: Enable Monitoring
1. Go to Admin Panel → Services
2. Edit a service
3. Enable "Enable Automatic Monitoring"
4. Set Monitor URL: `https://api.example.com/health`
5. Configure interval, timeout, and threshold
6. Save

### Step 2: Setup Periodic Checks
Run the setup script:
```bash
./scripts/setup-monitoring-cron.sh
```

Or manually add a cron job:
```bash
crontab -e
# Add: * * * * * curl -s http://your-status-page.com/api/monitoring/check
```

### Step 3: Monitor Status
The service status will now update automatically based on health checks.

View monitoring status in the admin panel:
- Last Checked At timestamp
- Last Check Status (Success/Failed)
- Consecutive Failures count

## Testing

All tests passed:
- ✅ TypeScript compilation
- ✅ ESLint validation
- ✅ Application build
- ✅ API route registration
- ✅ CodeQL security scan (0 vulnerabilities)

## Documentation

Complete documentation available in `MONITORING.md` including:
- Configuration guide
- Best practices
- Troubleshooting
- Security considerations
- Example setups

## Security Considerations

- ✅ No sensitive data in health check responses
- ✅ Proper timeout handling to prevent resource exhaustion
- ✅ Rate limiting via configurable intervals
- ✅ Type-safe input validation
- ✅ Error handling for network failures
- ✅ No security vulnerabilities detected by CodeQL

## Limitations

- Minimum check interval: 30 seconds
- Only HTTP/HTTPS protocols supported
- No custom headers or authentication (can be added if needed)
- Does not follow HTTP redirects (3xx responses)
- Manual status changes will be overwritten on next check

## Future Enhancements

Potential improvements for future PRs:
- Custom HTTP headers support
- Authentication support (Basic, Bearer tokens)
- Response body validation
- Automatic incident creation on status change
- Historical monitoring data and charts
- TCP/DNS/Ping monitoring support
