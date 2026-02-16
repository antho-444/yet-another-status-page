# Automatic Service Monitoring

This feature allows you to automatically monitor your services and update their status based on health check results.

## Overview

The monitoring system periodically checks configured service endpoints and automatically updates the service status based on the health check results:

- **Operational**: Service is responding as expected (0 consecutive failures)
- **Degraded Performance**: Service is failing but below the failure threshold (1-2 consecutive failures by default)
- **Major Outage**: Service has failed the health check multiple times consecutively (3+ failures by default)

## Configuration

### 1. Enable Monitoring for a Service

1. Go to the **Admin Panel** → **Services**
2. Edit or create a service
3. Expand the **Monitoring Configuration** section
4. Enable **"Enable Automatic Monitoring"**
5. Configure the monitoring settings:

   - **Monitor URL**: The URL to check (e.g., `https://api.example.com/health`)
   - **HTTP Method**: GET, HEAD, or POST (default: GET)
   - **Check Interval**: How often to check in seconds (minimum 30 seconds, default 60)
   - **Timeout**: Request timeout in seconds (default 10)
   - **Expected HTTP Status Code**: The status code that indicates the service is healthy (default 200)
   - **Failure Threshold**: Number of consecutive failures before marking as Major Outage (default 3)

6. Save the service

### 2. Set Up Periodic Monitoring

The monitoring system needs to be triggered periodically. You can do this in two ways:

#### Option A: Cron Job (Recommended for Production)

Set up a cron job to call the monitoring API endpoint:

```bash
# Run every minute
* * * * * curl -X GET http://your-status-page.com/api/monitoring/check
```

Or using a more robust approach with systemd timer, or a monitoring service like:
- GitHub Actions workflows (scheduled)
- AWS CloudWatch Events
- Kubernetes CronJob
- Any cron service

#### Option B: External Monitoring Service

Use a service like Uptime Robot, Better Uptime, or similar to:
1. Monitor your status page's monitoring endpoint
2. Call `GET /api/monitoring/check` at your desired interval

## API Endpoints

### Trigger All Monitoring Checks

```
GET /api/monitoring/check
```

This endpoint schedules health checks for all services that are due to be checked based on their configured intervals.

**Response:**
```json
{
  "message": "Monitoring checks scheduled successfully",
  "jobId": "clx123456"
}
```

### Trigger Check for Specific Service

```
POST /api/monitoring/check
Content-Type: application/json

{
  "serviceId": 123
}
```

This endpoint immediately queues a health check for a specific service.

**Response:**
```json
{
  "message": "Health check queued successfully",
  "serviceId": 123,
  "serviceName": "API Gateway"
}
```

## How It Works

### 1. Health Check Process

When a monitoring check is triggered:

1. The system fetches the service configuration
2. Makes an HTTP request to the configured URL
3. Checks if the response status code matches the expected value
4. Records the result and response time
5. Updates the consecutive failure count
6. Determines the appropriate service status based on the failure threshold

### 2. Status Updates

The service status is automatically updated based on consecutive failures:

- **0 failures** → Status changes to **Operational**
- **1-2 failures** (below threshold) → Status changes to **Degraded Performance**
- **3+ failures** (at or above threshold) → Status changes to **Major Outage**

The threshold is configurable per service (default: 3).

### 3. Background Jobs

The monitoring system uses Payload CMS's built-in job queue:

- **scheduleMonitoringChecks**: Scheduled task that determines which services need checking
- **checkServiceHealth**: Individual health check task for a specific service

Jobs are processed in the background and can be monitored in the Admin Panel under Jobs.

## Monitoring Fields

Each service with monitoring enabled has the following read-only status fields:

- **Last Checked At**: Timestamp of the last health check
- **Last Check Status**: Result of the last check (Success/Failed/Pending)
- **Consecutive Failures**: Number of consecutive failed checks

These fields are updated automatically and displayed in the service edit screen.

## Best Practices

### 1. Health Check Endpoints

Create dedicated health check endpoints for your services:

```javascript
// Example health check endpoint
app.get('/health', (req, res) => {
  // Check database connection
  // Check critical dependencies
  // Return 200 if everything is OK
  res.status(200).json({ status: 'ok' })
})
```

### 2. Check Intervals

- **Critical services**: 30-60 seconds
- **Normal services**: 60-300 seconds (1-5 minutes)
- **Less critical services**: 300-600 seconds (5-10 minutes)

Shorter intervals provide faster detection but generate more load on your services.

### 3. Failure Thresholds

- **Default (3)**: Good balance between false positives and quick detection
- **Higher (5+)**: Reduces false alarms for flaky services
- **Lower (1-2)**: Faster incident detection for critical services

### 4. Timeouts

- Set timeouts shorter than your check interval
- Default 10 seconds is reasonable for most services
- Adjust based on your service's expected response time

### 5. Expected Status Codes

- **200**: Standard success response
- **204**: No content (common for HEAD requests)
- **Other**: Match your specific health check endpoint's status code

## Example Setup

### Setup for a Web API

```
Service: API Gateway
Monitor URL: https://api.example.com/health
HTTP Method: GET
Check Interval: 60 seconds
Timeout: 10 seconds
Expected Status Code: 200
Failure Threshold: 3
```

### Setup for a Website

```
Service: Main Website
Monitor URL: https://www.example.com/
HTTP Method: HEAD
Check Interval: 120 seconds
Timeout: 15 seconds
Expected Status Code: 200
Failure Threshold: 2
```

### Setup for a Database Service (via Health Check)

```
Service: PostgreSQL Database
Monitor URL: https://api.example.com/health/database
HTTP Method: GET
Check Interval: 180 seconds
Timeout: 10 seconds
Expected Status Code: 200
Failure Threshold: 3
```

## Troubleshooting

### Monitoring Not Running

1. Verify monitoring is enabled for the service
2. Check that a monitoring URL is configured
3. Ensure the cron job or scheduled task is running
4. Check the Admin Panel → Jobs for any failed tasks

### False Positives

If services are being marked as down incorrectly:

1. Increase the **Failure Threshold** (e.g., from 3 to 5)
2. Increase the **Timeout** if services are slow to respond
3. Verify the **Expected Status Code** matches your endpoint
4. Check that the **Monitor URL** is correct and accessible

### Services Not Updating

1. Verify the monitoring check is being triggered (check Last Checked At)
2. Check the Jobs queue for failed tasks
3. Review application logs for errors
4. Test the health check URL manually with curl

### Performance Impact

If monitoring is causing performance issues:

1. Increase check intervals
2. Use HEAD requests instead of GET when possible
3. Ensure health check endpoints are lightweight
4. Consider reducing the number of monitored services

## Security Considerations

### Authentication

The monitoring API endpoints can be called without authentication. If you need to restrict access:

1. Use your web server (nginx, Apache) to restrict access by IP
2. Add API key authentication (requires code modification)
3. Run monitoring from a private network

### Health Check Endpoints

- Don't expose sensitive information in health check responses
- Use dedicated health check endpoints that don't require authentication
- Keep health check responses lightweight

## Limitations

- Minimum check interval is 30 seconds
- Only HTTP/HTTPS endpoints are supported
- No support for custom headers or authentication in health checks (can be added if needed)
- Status updates are automatic - manual status changes will be overwritten on next check

## Future Enhancements

Potential improvements for the monitoring system:

- Custom HTTP headers support
- Authentication support (Basic, Bearer tokens)
- Response body validation (check for specific content)
- Alerting integration (send notifications when status changes)
- Monitoring dashboard with historical data
- Support for other protocols (TCP, ping, DNS)
- Configurable status transitions (custom status per failure count)
