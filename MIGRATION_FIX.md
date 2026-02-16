# Database Migration Fix - Summary

## Problem
The application was failing with a SQL error:
```
Error: Failed query: select "id", "_order", "name", "slug", "description", "group_id", 
"status", "monitoring_enabled", "monitoring_url", "monitoring_method", "monitoring_interval", 
"monitoring_timeout", "monitoring_expected_status_code", "monitoring_last_checked_at", 
"monitoring_last_check_status", "monitoring_consecutive_failures", "monitoring_failure_threshold", 
"updated_at", "created_at" from "services"
```

This error occurred because the Services collection schema was updated to include monitoring fields, but the database schema was not updated with a migration.

## Solution
Created a database migration file that adds all required monitoring columns to the `services` table.

## Changes Made

### 1. Migration File
**File:** `src/migrations/20260216_171400_add_service_monitoring.ts`

This migration:
- Adds 10 monitoring-related columns to the `services` table
- Creates 2 new enum types for monitoring method and status
- Updates existing enum types to include new task slugs

### 2. Migration Registration
**File:** `src/migrations/index.ts`

Added the new migration to the migrations array so Payload CMS will run it.

### 3. Documentation
**File:** `MONITORING.md`

Updated documentation to include:
- Prerequisites section mentioning the migration requirement
- Troubleshooting section for database migration issues
- Instructions for verifying migration status

## How It Works

### Automatic Migration
When the application starts:
1. Payload CMS checks the `payload_migrations` table for applied migrations
2. If `20260216_171400_add_service_monitoring` hasn't been applied, it runs automatically
3. The migration adds all monitoring columns to the services table
4. The migration is marked as complete in the database

### Manual Verification
To verify the migration was applied:
```sql
SELECT name FROM payload_migrations WHERE name = '20260216_171400_add_service_monitoring';
```

Or check the services table structure:
```sql
\d services  -- PostgreSQL command
```

## Testing
- ✅ Build succeeds
- ✅ Linting passes (7 warnings about `any` in error handlers - acceptable)
- ✅ Migration syntax validated
- ✅ Documentation updated

## Rollback
If needed, the migration can be rolled back using the `down()` function, which:
- Drops the monitoring columns
- Drops the custom enum types
- Does NOT remove task slugs from existing enums (PostgreSQL doesn't support removing enum values)

## For Deployment

### New Installations
The migration will run automatically on first startup.

### Existing Installations
When upgrading to this version:
1. Stop the application
2. Start the application (migration runs automatically)
3. Verify monitoring fields appear in the admin panel

### Docker Deployments
The migration runs automatically when the container starts. No manual intervention needed.

### Vercel/Cloud Deployments
Migrations run automatically as part of the build/deploy process.

## Related Files
- `src/collections/Services.ts` - Service schema with monitoring fields
- `src/lib/monitoring.ts` - Health check utilities
- `src/tasks/checkServiceHealth.ts` - Health check job handler
- `src/tasks/scheduleMonitoringChecks.ts` - Scheduling job handler
- `payload.config.ts` - Job registration
- `MONITORING.md` - Complete monitoring documentation
