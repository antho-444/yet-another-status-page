/**
 * Automatic monitoring scheduler using node-cron
 * Runs periodic health checks without requiring external cron setup
 */

import cron, { ScheduledTask } from 'node-cron'
import { getPayload, Payload } from 'payload'
import config from '@payload-config'

let monitoringTask: ScheduledTask | null = null
let currentSchedule: string = '* * * * *'

/**
 * Get schedule from database settings or environment variable
 */
async function getScheduleFromSettings(payloadInstance?: Payload): Promise<{ enabled: boolean; schedule: string }> {
  try {
    // Use provided instance or get new one (for restart scenarios)
    const payload = payloadInstance || await getPayload({ config })
    const settings = await payload.findGlobal({ slug: 'settings' })
    
    if (settings) {
      const enabled = settings.monitoringEnabled !== false // Default to true if undefined
      const schedule = settings.monitoringScheduleCron || '* * * * *'
      return { enabled, schedule }
    }
  } catch (error) {
    console.log('[Monitoring Scheduler] Could not load settings from database, using defaults')
  }
  
  // Fallback to environment variables
  const enabled = process.env.ENABLE_AUTO_MONITORING !== 'false'
  const schedule = process.env.MONITORING_SCHEDULE || '* * * * *'
  return { enabled, schedule }
}

/**
 * Start the automatic monitoring scheduler
 * @param schedule Cron schedule (optional, will be read from settings if not provided)
 * @param payloadInstance Optional Payload instance (avoids circular dependency during onInit)
 */
export async function startMonitoringScheduler(schedule?: string, payloadInstance?: Payload) {
  if (monitoringTask) {
    console.log('[Monitoring Scheduler] Already running')
    return
  }

  // Get schedule from settings or use provided/default
  const { enabled, schedule: dbSchedule } = await getScheduleFromSettings(payloadInstance)
  const finalSchedule = schedule || dbSchedule
  
  if (!enabled) {
    console.log('[Monitoring Scheduler] Monitoring disabled in settings')
    return
  }

  // Validate cron schedule
  if (!cron.validate(finalSchedule)) {
    console.error(`[Monitoring Scheduler] Invalid cron schedule: ${finalSchedule}`)
    throw new Error(`Invalid cron schedule: ${finalSchedule}`)
  }

  currentSchedule = finalSchedule
  console.log('[Monitoring Scheduler] Starting automatic monitoring scheduler')
  console.log(`[Monitoring Scheduler] Schedule: ${currentSchedule}`)

  monitoringTask = cron.schedule(currentSchedule, async () => {
    console.log(`\n[Monitoring Scheduler] ========================================`)
    console.log(`[Monitoring Scheduler] Triggering scheduled monitoring checks`)
    console.log(`[Monitoring Scheduler] Time: ${new Date().toISOString()}`)
    console.log(`[Monitoring Scheduler] ========================================\n`)

    try {
      const payload = await getPayload({ config })

      // Queue the scheduled monitoring task
      const job = await payload.jobs.queue({
        task: 'scheduleMonitoringChecks',
        input: {},
      })

      console.log(`[Monitoring Scheduler] Job queued: ${job.id}`)

      // Run the job immediately
      await payload.jobs.run()

      console.log(`[Monitoring Scheduler] Monitoring checks completed`)
    } catch (error: any) {
      console.error(`[Monitoring Scheduler] Error:`, error.message)
    }
  })

  console.log('[Monitoring Scheduler] Scheduler started successfully')
}

/**
 * Stop the monitoring scheduler
 */
export function stopMonitoringScheduler() {
  if (monitoringTask) {
    console.log('[Monitoring Scheduler] Stopping scheduler...')
    monitoringTask.stop()
    monitoringTask = null
    console.log('[Monitoring Scheduler] Scheduler stopped')
  }
}

/**
 * Restart the monitoring scheduler with new schedule
 * Useful when settings are changed
 */
export async function restartMonitoringScheduler() {
  console.log('[Monitoring Scheduler] Restarting scheduler...')
  stopMonitoringScheduler()
  await startMonitoringScheduler()
}

/**
 * Get the monitoring scheduler status
 */
export function getSchedulerStatus(): { running: boolean; schedule: string } {
  return {
    running: monitoringTask !== null,
    schedule: currentSchedule,
  }
}
