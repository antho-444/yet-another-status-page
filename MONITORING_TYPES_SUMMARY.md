# Multiple Monitoring Types - Feature Summary

## Overview

Successfully implemented support for 4 different monitoring types in the status page, expanding beyond the original HTTP-only monitoring.

## Monitoring Types Implemented

### 1. HTTP/HTTPS (Enhanced)
**Original feature, now part of type selection**

- **Use Case**: Web services, REST APIs, GraphQL endpoints, health check URLs
- **Method**: Makes HTTP/HTTPS requests and validates status code
- **Configuration**: URL, HTTP method (GET/HEAD/POST), expected status code
- **Benefits**: Full HTTP protocol support, status code validation
- **Example**: Monitor API endpoint at `https://api.example.com/health`

### 2. TCP Port Check (NEW)
**Check if a specific port is open and accepting connections**

- **Use Case**: Database servers, SSH servers, mail servers, any TCP service
- **Method**: Attempts to establish TCP connection to host:port
- **Configuration**: Hostname/IP, Port number
- **Benefits**: Direct port checking without application-level protocol
- **Examples**:
  - MySQL: `db.example.com:3306`
  - SSH: `server.example.com:22`
  - Redis: `cache.example.com:6379`

### 3. Ping / ICMP (NEW)
**Basic reachability testing**

- **Use Case**: Check if server is online, network connectivity testing
- **Method**: Sends ICMP ping packets using system `ping` command
- **Configuration**: Hostname/IP
- **Benefits**: Simplest monitoring, no service-specific setup needed
- **Examples**:
  - Server: `server.example.com`
  - Gateway: `192.168.1.1`
  - DNS: `8.8.8.8`

### 4. GameDig (NEW)
**Game server monitoring with native protocol support**

- **Use Case**: Game servers (Minecraft, CS, Rust, ARK, etc.)
- **Method**: Queries game server using native protocol via GameDig library
- **Configuration**: Hostname/IP, Port (optional), Game Type
- **Benefits**: Accurate game server status, player count, server name
- **Supported Games**:
  - Minecraft (Java & Bedrock)
  - Counter-Strike (CS, CS:GO, CS2)
  - Team Fortress 2
  - Garry's Mod
  - ARK: Survival Evolved
  - Rust
  - 7 Days to Die
  - Valheim
  - 200+ more via GameDig library

## Technical Implementation

### Architecture

```
Service Configuration
        ↓
Monitoring Type Selection
        ↓
Type-Specific Fields
        ↓
performHealthCheck() dispatcher
        ↓
┌───────────┬──────────┬──────────┬────────────┐
│   HTTP    │   TCP    │   Ping   │  GameDig   │
└───────────┴──────────┴──────────┴────────────┘
        ↓
MonitoringCheckResult
        ↓
Status Update
```

### Code Structure

**1. Services Collection** (`src/collections/Services.ts`)
- Added `type` field with 4 monitoring type options
- Added `host` field for non-HTTP monitoring
- Added `port` field for TCP and GameDig
- Added `gameType` field for GameDig
- Conditional field visibility based on selected type

**2. Monitoring Library** (`src/lib/monitoring.ts`)
```typescript
export async function performHealthCheck(config: MonitoringConfig) {
  switch (config.type) {
    case 'http': return performHttpCheck(config)
    case 'tcp': return performTcpCheck(config)
    case 'ping': return performPingCheck(config)
    case 'gamedig': return performGameDigCheck(config)
  }
}
```

**3. Individual Check Functions**
- `performHttpCheck()` - Existing HTTP logic, uses fetch API
- `performTcpCheck()` - New, uses Node.js net.Socket
- `performPingCheck()` - New, uses system ping command
- `performGameDigCheck()` - New, uses GameDig library

**4. Health Check Task** (`src/tasks/checkServiceHealth.ts`)
- Builds config object based on monitoring type
- Validates type-specific required fields
- Passes to performHealthCheck dispatcher

**5. Scheduler Task** (`src/tasks/scheduleMonitoringChecks.ts`)
- Validates services have appropriate config for their type
- Skips services with invalid configuration

### Database Schema

**New Migration**: `20260216_184200_add_monitoring_types.ts`

**Enums Created:**
```sql
CREATE TYPE "enum_services_monitoring_type" AS ENUM('http', 'tcp', 'ping', 'gamedig');
CREATE TYPE "enum_services_monitoring_game_type" AS ENUM('minecraft', 'cs', 'tf2', ...);
```

**Columns Added:**
```sql
ALTER TABLE "services" ADD COLUMN "monitoring_type" ... DEFAULT 'http';
ALTER TABLE "services" ADD COLUMN "monitoring_host" varchar;
ALTER TABLE "services" ADD COLUMN "monitoring_port" numeric;
ALTER TABLE "services" ADD COLUMN "monitoring_game_type" ...;
```

## Usage Examples

### HTTP Monitoring
```
Service: API Gateway
Type: HTTP/HTTPS
URL: https://api.example.com/health
Method: GET
Expected Status: 200
Interval: 60s
```

### TCP Monitoring
```
Service: MySQL Database
Type: TCP Port
Host: db.example.com
Port: 3306
Interval: 60s
```

### Ping Monitoring
```
Service: Web Server
Type: Ping (ICMP)
Host: server.example.com
Interval: 60s
```

### GameDig Monitoring
```
Service: Minecraft Server
Type: Game Server (GameDig)
Host: mc.example.com
Port: 25565
Game Type: Minecraft
Interval: 120s
```

## Dependencies

### Added Packages
- `gamedig` - Game server query library (^5.0.0)
- `@types/gamedig` - TypeScript types for GameDig (^4.2.0)

### Built-in Modules Used
- `net` - TCP socket connections (Node.js built-in)
- `child_process` - Execute ping command (Node.js built-in)

## Benefits

### For Users
1. **Flexibility**: Choose appropriate monitoring for each service
2. **Accuracy**: Use native protocols for better reliability
3. **Simplicity**: Ping monitoring requires minimal configuration
4. **Gaming**: First-class support for game server monitoring
5. **Comprehensive**: Cover more service types beyond just HTTP

### For Administrators
1. **Database Monitoring**: Direct TCP checks to database ports
2. **Infrastructure**: Ping network devices and servers
3. **Game Servers**: Monitor player counts and availability
4. **SSH Access**: Verify SSH services are accessible

## Limitations

### General
- Minimum check interval: 30 seconds
- No custom authentication support (HTTP)
- No custom headers support (HTTP)

### Type-Specific
- **HTTP**: No redirect following, no body validation
- **TCP**: Port check only, not health verification
- **Ping**: Requires ICMP, may not work in all environments
- **GameDig**: Requires npm package, game-specific support

## Testing Recommendations

### HTTP
```bash
curl -I https://api.example.com/health
```

### TCP
```bash
nc -zv db.example.com 3306
# or
telnet db.example.com 3306
```

### Ping
```bash
ping -c 1 server.example.com
```

### GameDig
```bash
npm install -g gamedig
gamedig --type minecraft mc.example.com
```

## Migration Path

### For Existing Installations
1. Migration `20260216_184200_add_monitoring_types` runs automatically
2. Existing services default to `type='http'`
3. Existing configuration (URL, method, etc.) remains valid
4. No breaking changes to existing monitoring

### For New Installations
1. All monitoring types available immediately
2. Choose type first, then configure type-specific fields
3. All migrations run during first startup

## Future Enhancements

Potential additions:
- DNS monitoring (check DNS records)
- Certificate monitoring (SSL/TLS expiration)
- Custom HTTP headers/authentication
- Response body validation
- More game types
- WebSocket monitoring
- gRPC health checks

## Files Changed

1. `src/collections/Services.ts` - Added type field and type-specific fields
2. `src/migrations/20260216_184200_add_monitoring_types.ts` - Database migration
3. `src/migrations/index.ts` - Registered new migration
4. `src/lib/monitoring.ts` - Refactored with 4 check functions
5. `src/tasks/checkServiceHealth.ts` - Type-based config building
6. `src/tasks/scheduleMonitoringChecks.ts` - Type-based validation
7. `src/payload-types.ts` - Generated types
8. `package.json` / `package-lock.json` - Added gamedig dependency
9. `MONITORING.md` - Complete documentation update

**Total Changes:**
- 9 files modified
- 2 new files (migration, this summary)
- ~900 lines of code added
- ~250 lines of documentation added

## Success Criteria

- ✅ Build successful
- ✅ TypeScript compilation clean
- ✅ All monitoring types implemented
- ✅ Database migration created
- ✅ Documentation complete
- ✅ Examples provided
- ⏳ Manual testing pending

## Summary

Successfully expanded monitoring capabilities from HTTP-only to 4 comprehensive monitoring types. Users can now monitor web services, databases, network infrastructure, and game servers all from a single status page. Each monitoring type uses the appropriate protocol and method for accurate health checking.
