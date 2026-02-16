import type { BasePayload } from 'payload'
import type { Service } from '@/payload-types'

interface TaskHandlerArgs {
  req: {
    payload: BasePayload
  }
}

/**
 * Task handler for scheduling health checks for all monitored services
 * This runs periodically and queues individual health check tasks
 */
export async function scheduleMonitoringChecksHandler({ req }: TaskHandlerArgs) {
  const { payload } = req

  try {
    // Find all services with monitoring enabled
    const services = await payload.find({
      collection: 'services',
      where: {
        'monitoring.enabled': {
          equals: true,
        },
      },
      limit: 1000, // Reasonable limit for services
    })

    const now = Date.now()
    const tasksQueued: string[] = []
    const tasksSkipped: string[] = []

    // Queue health check tasks for services that need checking
    for (const service of services.docs as Service[]) {
      if (!service.monitoring?.url) {
        tasksSkipped.push(`${service.name}: No URL configured`)
        continue
      }

      const interval = (service.monitoring.interval || 60) * 1000 // Convert to milliseconds
      const lastChecked = service.monitoring.lastCheckedAt
        ? new Date(service.monitoring.lastCheckedAt).getTime()
        : 0

      // Check if enough time has passed since last check
      if (now - lastChecked >= interval) {
        // Queue the health check task
        await payload.jobs.queue({
          task: 'checkServiceHealth',
          input: {
            serviceId: String(service.id), // Convert number to string for job input
          },
        })

        tasksQueued.push(service.name)
      } else {
        tasksSkipped.push(`${service.name}: Too soon (${Math.round((interval - (now - lastChecked)) / 1000)}s remaining)`)
      }
    }

    return {
      output: {
        success: true,
        totalServices: services.docs.length,
        tasksQueued: tasksQueued.length,
        tasksSkipped: tasksSkipped.length,
        queuedServices: tasksQueued,
        skippedServices: tasksSkipped,
      },
    }
  } catch (error: any) {
    console.error('Error scheduling monitoring checks:', error)
    return {
      output: {
        success: false,
        message: error.message || 'Unknown error',
      },
    }
  }
}
