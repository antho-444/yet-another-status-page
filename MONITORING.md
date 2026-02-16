# Automatic Service Monitoring

This feature allows you to automatically monitor your services and update their status based on health check results.

## Prerequisites

- **Database Migration**: This feature requires database migrations to add monitoring fields to the services table. The migrations will run automatically when:
  - Starting the application for the first time with an existing database
  - Upgrading from a version without monitoring support
  
  Required migrations:
  - `20260216_171400_add_service_monitoring` - Base monitoring fields
  - `20260216_184200_add_monitoring_types` - Multiple monitoring types support

## Overview

The monitoring system supports **four different monitoring methods**:

1. **HTTP/HTTPS** - Monitor web services and APIs
2. **TCP Port** - Check if a port is open and accepting connections
3. **Ping (ICMP)** - Basic reachability testing
4. **GameDig** - Monitor game servers with player count

The service status is automatically updated based on health check results:

- **Operational**: Service is responding as expected (0 consecutive failures)
- **Degraded Performance**: Service is failing but below the failure threshold (1-2 consecutive failures by default)
- **Major Outage**: Service has failed the health check multiple times consecutively (3+ failures by default)

## Monitoring Types

### HTTP/HTTPS Monitoring

Monitor web services, APIs, and health check endpoints.

**Use Cases:**
- Web applications
- REST APIs
- GraphQL endpoints
- Health check URLs

**Configuration:**
- **Monitor URL**: The URL to check (e.g., `https://api.example.com/health`)
- **HTTP Method**: GET, HEAD, or POST (default: GET)
- **Expected HTTP Status Code**: The status code that indicates the service is healthy (default: 200)

### TCP Port Monitoring

Check if a specific port on a host is open and accepting connections.

**Use Cases:**
- Database servers (MySQL, PostgreSQL, MongoDB)
- SSH servers
- Mail servers (SMTP, IMAP)
- Any TCP-based service

**Configuration:**
- **Hostname or IP**: Server address (e.g., `db.example.com` or `192.168.1.100`)
- **Port Number**: Port to check (e.g., `3306` for MySQL, `22` for SSH)

**Examples:**
- MySQL: host=`db.example.com`, port=`3306`
- SSH: host=`server.example.com`, port=`22`
- PostgreSQL: host=`postgres.example.com`, port=`5432`
- Redis: host=`cache.example.com`, port=`6379`

### Ping (ICMP) Monitoring

Basic reachability testing using ICMP ping.

**Use Cases:**
- Check if a server is online
- Network connectivity testing
- Simple availability monitoring

**Configuration:**
- **Hostname or IP**: Server address to ping (e.g., `server.example.com` or `8.8.8.8`)

**Note:** Requires the server running the status page to have ping capabilities. Some cloud providers may restrict ICMP.

### GameDig Monitoring

Monitor game servers using the GameDig library, which supports querying game servers using their native protocols.

**Use Cases:**
- Minecraft servers
- Counter-Strike servers
- Team Fortress 2 servers
- ARK: Survival Evolved servers
- Rust servers
- Any game server supported by GameDig

**Configuration:**
- **Hostname or IP**: Game server address
- **Port Number**: Game server port (optional, defaults to game's standard port)
- **Game Type**: Select from supported games

**Supported Games:**
- Minecraft
- Counter-Strike (CS)
- Team Fortress 2 (TF2)
- Garry's Mod
- ARK: Survival Evolved
- Rust
- 7 Days to Die
- Valheim

**Benefits:**
- Shows current player count
- Verifies server is online and responding
- Uses game-specific protocol for accurate results

## Configuration

### 1. Enable Monitoring for a Service

1. Go to the **Admin Panel** → **Services**
2. Edit or create a service
3. Expand the **Monitoring Configuration** section
4. Enable **"Enable Automatic Monitoring"**
5. Select **Monitoring Type** (HTTP/HTTPS, TCP Port, Ping, or GameDig)
6. Configure type-specific settings (URL, host, port, etc.)
7. Configure common settings:
   - **Check Interval**: How often to check in seconds (minimum 30 seconds, default 60)
   - **Timeout**: Request timeout in seconds (default 10)
   - **Failure Threshold**: Number of consecutive failures before marking as Major Outage (default 3)
8. Save the service

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

This endpoint executes health checks for all services that are due to be checked based on their configured intervals. The health checks run immediately and service statuses are updated before the endpoint returns.

**Response:**
```json
{
  "message": "Monitoring checks completed",
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

This endpoint immediately executes a health check for a specific service. The health check runs and the service status is updated before the endpoint returns.

**Response:**
```json
{
  "message": "Health check completed",
  "serviceId": 123,
  "serviceName": "API Gateway"
}
```

## How It Works

### 1. Health Check Process

When a monitoring check is triggered:

1. The system fetches the service configuration
2. Performs the appropriate check based on monitoring type:
   - **HTTP**: Makes an HTTP request and checks status code
   - **TCP**: Attempts to connect to the specified port
   - **Ping**: Sends ICMP ping packets
   - **GameDig**: Queries game server using native protocol
3. Records the result and response time
4. Updates the consecutive failure count
5. Determines the appropriate service status based on the failure threshold

### 2. Status Updates

The service status is automatically updated based on consecutive failures:

- **0 failures** → Status changes to **Operational**
- **1-2 failures** (below threshold) → Status changes to **Degraded Performance**
- **3+ failures** (at or above threshold) → Status changes to **Major Outage**

The threshold is configurable per service (default: 3).

### 3. Job Execution

The monitoring system uses Payload CMS's built-in job queue:

- **scheduleMonitoringChecks**: Task that determines which services need checking based on their intervals
- **checkServiceHealth**: Individual health check task for a specific service

When you call the monitoring API endpoints, jobs are queued and **executed immediately** before the API returns. This ensures:
- Health checks run synchronously when triggered via API
- Service statuses are updated in real-time
- You can verify results immediately after calling the endpoint

**Note:** The API endpoints include `await payload.jobs.run()` which processes all queued jobs before returning the response.

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

**Note**: The monitoring system does not follow HTTP redirects (3xx responses). If your health check endpoint returns a redirect, either:
- Configure the endpoint to return 200 directly
- Set the monitor URL to the final destination
- Adjust your endpoint to return a non-redirect status code

## Example Setups

### HTTP/HTTPS Examples

#### Web API
```
Monitoring Type: HTTP/HTTPS
Monitor URL: https://api.example.com/health
HTTP Method: GET
Check Interval: 60 seconds
Timeout: 10 seconds
Expected Status Code: 200
Failure Threshold: 3
```

#### Website
```
Monitoring Type: HTTP/HTTPS
Monitor URL: https://www.example.com/
HTTP Method: HEAD
Check Interval: 120 seconds
Timeout: 15 seconds
Expected Status Code: 200
Failure Threshold: 2
```

### TCP Port Examples

#### MySQL Database
```
Monitoring Type: TCP Port
Hostname or IP: db.example.com
Port Number: 3306
Check Interval: 60 seconds
Timeout: 10 seconds
Failure Threshold: 3
```

#### SSH Server
```
Monitoring Type: TCP Port
Hostname or IP: server.example.com
Port Number: 22
Check Interval: 300 seconds
Timeout: 10 seconds
Failure Threshold: 3
```

#### Redis Cache
```
Monitoring Type: TCP Port
Hostname or IP: cache.example.com
Port Number: 6379
Check Interval: 60 seconds
Timeout: 5 seconds
Failure Threshold: 2
```

### Ping Examples

#### Server Reachability
```
Monitoring Type: Ping (ICMP)
Hostname or IP: server.example.com
Check Interval: 60 seconds
Timeout: 10 seconds
Failure Threshold: 3
```

#### Network Gateway
```
Monitoring Type: Ping (ICMP)
Hostname or IP: 192.168.1.1
Check Interval: 30 seconds
Timeout: 5 seconds
Failure Threshold: 5
```

### GameDig Examples

#### Minecraft Server
```
Monitoring Type: Game Server (GameDig)
Hostname or IP: mc.example.com
Port Number: 25565 (optional, uses default)
Game Type: Minecraft
Check Interval: 120 seconds
Timeout: 10 seconds
Failure Threshold: 2
```

#### Rust Server
```
Monitoring Type: Game Server (GameDig)
Hostname or IP: rust.example.com
Port Number: 28015
Game Type: Rust
Check Interval: 180 seconds
Timeout: 15 seconds
Failure Threshold: 3
```

#### Counter-Strike Server
```
Monitoring Type: Game Server (GameDig)
Hostname or IP: cs.example.com
Port Number: 27015
Game Type: Counter-Strike
Check Interval: 120 seconds
Timeout: 10 seconds
Failure Threshold: 2
```

## Troubleshooting

### Database Migration Issues

If you see errors about missing columns like `monitoring_enabled`, `monitoring_url`, etc.:

1. **Check Migration Status**: Ensure the database migration has been applied
   - The migration `20260216_171400_add_service_monitoring` adds the monitoring fields
   - Migrations run automatically when the application starts

2. **Manual Migration** (if needed):
   - Restart the application to trigger pending migrations
   - Check application logs for migration errors
   - Verify database connection and permissions

3. **Fresh Installation**: For new installations, all migrations run automatically during first startup

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

### General
- Minimum check interval is 30 seconds
- Status updates are automatic - manual status changes will be overwritten on next check
- No support for custom headers or authentication in HTTP health checks (can be added if needed)

### Monitoring Type Specific

**HTTP/HTTPS:**
- Follows redirects automatically (e.g., http://google.com → https://www.google.com)
- Redirect following limited by fetch API (typically 20 redirects max)
- No response body validation (only status code)
- Final destination URL after redirects is checked

**TCP:**
- Only checks if port is open, not if service is healthy
- Cannot verify application-level functionality

**Ping:**
- Requires ICMP to be allowed on the network
- Some cloud providers block ICMP
- Server running status page needs ping command available
- May not work in Docker without proper network configuration

**GameDig:**
- Requires `gamedig` npm package to be installed
- Only supports games in the GameDig library
- Some game servers may have query disabled
- Port detection may not work for all games (manual port configuration recommended)

## Dependencies

### GameDig Package

GameDig monitoring requires the `gamedig` npm package:

```bash
npm install gamedig
npm install --save-dev @types/gamedig
```

This is automatically installed when you build the application. If GameDig is not available, services configured with GameDig monitoring will fail with a helpful error message.

**Supported Game Servers:**
GameDig supports 200+ game protocols. The status page includes these popular options:
- Minecraft (Java & Bedrock)
- Counter-Strike (CS, CS:GO, CS2)
- Team Fortress 2
- Garry's Mod
- ARK: Survival Evolved
- Rust
- 7 Days to Die
- Valheim

For a complete list of supported games, see: https://github.com/gamedig/node-gamedig

## Future Enhancements

Potential improvements for the monitoring system:

- Custom HTTP headers support
- Authentication support (Basic, Bearer tokens)
- Response body validation (check for specific content)
- Alerting integration (send notifications when status changes)
- Monitoring dashboard with historical data
- DNS monitoring
- Certificate expiration monitoring
- Configurable status transitions (custom status per failure count)
- More game types for GameDig
