/**
 * Automatic monitoring scheduler using node-cron
 * Runs periodic health checks without requiring external cron setup
 */

import cron, { ScheduledTask } from 'node-cron'
import { getPayload } from 'payload'
import config from '@payload-config'

let monitoringTask: ScheduledTask | null = null

/**
 * Start the automatic monitoring scheduler
 * @param schedule Cron schedule (default: every minute)
 */
export async function startMonitoringScheduler(schedule: string = '* * * * *') {
  if (monitoringTask) {
    console.log('[Monitoring Scheduler] Already running')
    return
  }

  // Validate cron schedule
  if (!cron.validate(schedule)) {
    console.error(`[Monitoring Scheduler] Invalid cron schedule: ${schedule}`)
    throw new Error(`Invalid cron schedule: ${schedule}`)
  }

  console.log('[Monitoring Scheduler] Starting automatic monitoring scheduler')
  console.log(`[Monitoring Scheduler] Schedule: ${schedule}`)

  monitoringTask = cron.schedule(schedule, async () => {
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
 * Get the monitoring scheduler status
 */
export function getSchedulerStatus(): { running: boolean; schedule?: string } {
  return {
    running: monitoringTask !== null,
  }
}
