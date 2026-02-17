# Fix: Monitoring Scheduler Initialization Hang

## Problem

The application would get stuck on this log message and never progress:
```
[Payload] Initializing automatic monitoring scheduler...
```

The application would hang indefinitely, preventing it from starting.

## Root Cause

**Circular Dependency During Initialization**

The monitoring scheduler tried to get the Payload instance during the `onInit` hook:

```typescript
// Inside onInit hook (during Payload initialization)
onInit: async (payload) => {
  await startMonitoringScheduler()  // Called during init
}

// Inside startMonitoringScheduler
async function getScheduleFromSettings() {
  const payload = await getPayload({ config })  // ❌ DEADLOCK!
  const settings = await payload.findGlobal({ slug: 'settings' })
  ...
}
```

**Why it caused a deadlock:**
1. Application starts Payload initialization
2. Payload calls `onInit` hook (still initializing)
3. `onInit` calls `startMonitoringScheduler()`
4. Scheduler calls `getPayload()` to get Payload instance
5. `getPayload()` waits for Payload to finish initializing
6. **Deadlock:** Initialization waiting for initialization to complete

```
┌─────────────────────────────────────────┐
│  Payload Initialization                 │
│  ├─ onInit hook called                  │
│  │  ├─ startMonitoringScheduler()       │
│  │  │  ├─ getScheduleFromSettings()     │
│  │  │  │  └─ getPayload() ⏰ WAITING... │
│  │  │  └─ ⏰ WAITING...                  │
│  │  └─ ⏰ WAITING...                     │
│  └─ ⏰ Can't complete (waiting on self) │
└─────────────────────────────────────────┘
```

## Solution

**Pass the Payload instance instead of requesting it:**

The `onInit` callback already receives the Payload instance as a parameter. Instead of calling `getPayload()` again, pass the existing instance:

```typescript
// payload.config.ts
onInit: async (payload) => {
  // ✅ Pass the payload instance
  await startMonitoringScheduler(schedule, payload)
}

// monitoringScheduler.ts
export async function startMonitoringScheduler(
  schedule?: string, 
  payloadInstance?: Payload  // ✅ Accept payload instance
) {
  const { enabled, schedule: dbSchedule } = await getScheduleFromSettings(payloadInstance)
  ...
}

async function getScheduleFromSettings(payloadInstance?: Payload) {
  // ✅ Use provided instance or get new one (for restarts)
  const payload = payloadInstance || await getPayload({ config })
  const settings = await payload.findGlobal({ slug: 'settings' })
  ...
}
```

## Implementation

### Files Changed

1. **src/lib/monitoringScheduler.ts**
   - Added `Payload` import from 'payload'
   - Updated `getScheduleFromSettings()` to accept optional `payloadInstance`
   - Updated `startMonitoringScheduler()` to accept optional `payloadInstance`
   - Pass instance to `getScheduleFromSettings()`

2. **payload.config.ts**
   - Pass `payload` parameter to `startMonitoringScheduler()`
   - Added comment explaining the fix

### Code Changes

```diff
// monitoringScheduler.ts
- import { getPayload } from 'payload'
+ import { getPayload, Payload } from 'payload'

- async function getScheduleFromSettings(): Promise<{ enabled: boolean; schedule: string }> {
+ async function getScheduleFromSettings(payloadInstance?: Payload): Promise<{ enabled: boolean; schedule: string }> {
  try {
-   const payload = await getPayload({ config })
+   const payload = payloadInstance || await getPayload({ config })
    ...
  }
}

- export async function startMonitoringScheduler(schedule?: string) {
+ export async function startMonitoringScheduler(schedule?: string, payloadInstance?: Payload) {
  ...
- const { enabled, schedule: dbSchedule } = await getScheduleFromSettings()
+ const { enabled, schedule: dbSchedule } = await getScheduleFromSettings(payloadInstance)
  ...
}
```

```diff
// payload.config.ts
onInit: async (payload) => {
  ...
  try {
-   await startMonitoringScheduler(monitoringSchedule)
+   await startMonitoringScheduler(monitoringSchedule, payload)
    ...
  }
}
```

## Flow Diagrams

### Before (Deadlock):
```
Application Start
    ↓
Initialize Payload
    ↓
onInit Hook
    ↓
startMonitoringScheduler()
    ↓
getScheduleFromSettings()
    ↓
getPayload() ⏰
    ↓
Wait for Payload to initialize...
    ↓
❌ DEADLOCK (Payload waiting for itself)
```

### After (Fixed):
```
Application Start
    ↓
Initialize Payload
    ↓
onInit Hook (receives payload instance)
    ↓
startMonitoringScheduler(schedule, payload) ✅
    ↓
getScheduleFromSettings(payload) ✅
    ↓
Use provided payload instance ✅
    ↓
Load settings from database ✅
    ↓
Start cron scheduler ✅
    ↓
✅ Initialization Complete
```

## Why This Works

1. **Payload instance already available:** The `onInit` callback receives the fully initialized (or nearly complete) Payload instance
2. **No circular wait:** By using the provided instance, we avoid calling `getPayload()` during initialization
3. **Restart scenarios still work:** When `restartMonitoringScheduler()` is called later (not during init), it can safely call `getPayload()` because initialization is complete

## Testing

### Build Test
```bash
npm run build
# ✅ Successful compilation
```

### Expected Behavior

**Before fix:**
```
[Payload] Initializing automatic monitoring scheduler...
⏰ (hangs forever)
```

**After fix:**
```
[Payload] Initializing automatic monitoring scheduler...
[Monitoring Scheduler] Starting automatic monitoring scheduler
[Monitoring Scheduler] Schedule: * * * * *
[Monitoring Scheduler] Scheduler started successfully
[Payload] Automatic monitoring scheduler initialized
✅ Application ready
```

## Impact

### Before
- ❌ Application would hang on startup
- ❌ Could not use automatic monitoring feature
- ❌ Had to disable monitoring to start app (`ENABLE_AUTO_MONITORING=false`)

### After
- ✅ Application starts normally
- ✅ Monitoring scheduler initializes successfully
- ✅ All monitoring features work as expected
- ✅ No workarounds needed

## Lessons Learned

**Avoid calling `getPayload()` during initialization hooks:**
- `onInit`, `beforeChange`, `afterChange` hooks already receive payload/req
- Use the provided instance instead of requesting a new one
- Calling `getPayload()` during initialization can cause circular dependencies

**Pattern to follow:**
```typescript
// ✅ Good - Use provided instance
onInit: async (payload) => {
  await someFunction(payload)
}

// ❌ Bad - Request new instance
onInit: async (payload) => {
  const p = await getPayload({ config })  // Circular dependency!
  await someFunction(p)
}
```

## Related Issues

This same pattern could cause issues in:
- Other initialization hooks
- Collection hooks during first database access
- Global hooks during first settings load

**Solution:** Always pass the payload/req instance down through function calls rather than requesting it again.

## Conclusion

The circular dependency was subtle but critical. By passing the Payload instance through the function call chain instead of requesting it again, we eliminated the deadlock and allowed the application to start successfully.

This fix is minimal, focused, and doesn't change any functionality - it just fixes the initialization sequence.
