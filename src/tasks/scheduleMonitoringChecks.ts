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
    // Find all services with monitoring enabled, excluding those in maintenance status
    // Services under maintenance should not be automatically monitored since they are
    // intentionally offline or undergoing maintenance work
    const services = await payload.find({
      collection: 'services',
      where: {
        and: [
          {
            'monitoring.enabled': {
              equals: true,
            },
          },
          {
            status: {
              not_equals: 'maintenance',
            },
          },
        ],
      },
      limit: 1000, // Reasonable limit for services
    })

    const now = Date.now()
    const tasksQueued: string[] = []
    const tasksSkipped: string[] = []
    const maintenanceServices: string[] = []

    // Queue health check tasks for services that need checking
    for (const service of services.docs as Service[]) {
      // Validate configuration based on monitoring type
      const monitoringType = service.monitoring?.type || 'http'
      let hasValidConfig = false

      if (monitoringType === 'http') {
        hasValidConfig = !!service.monitoring?.url
      } else if (monitoringType === 'tcp') {
        hasValidConfig = !!(service.monitoring?.host && service.monitoring?.port)
      } else if (monitoringType === 'ping') {
        hasValidConfig = !!service.monitoring?.host
      } else if (monitoringType === 'gamedig') {
        hasValidConfig = !!(service.monitoring?.host && service.monitoring?.gameType)
      }

      if (!hasValidConfig) {
        tasksSkipped.push(`${service.name}: Invalid ${monitoringType} configuration`)
        continue
      }

      if (!service.monitoring) {
        tasksSkipped.push(`${service.name}: No monitoring configuration`)
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

    // Count how many services with monitoring enabled are in maintenance status
    const maintenanceServicesResult = await payload.find({
      collection: 'services',
      where: {
        and: [
          {
            'monitoring.enabled': {
              equals: true,
            },
          },
          {
            status: {
              equals: 'maintenance',
            },
          },
        ],
      },
      limit: 1000,
    })

    // Track maintenance service names for logging
    for (const service of maintenanceServicesResult.docs as Service[]) {
      maintenanceServices.push(service.name)
    }

    return {
      output: {
        success: true,
        totalServices: services.docs.length,
        maintenanceServices: maintenanceServices.length,
        tasksQueued: tasksQueued.length,
        tasksSkipped: tasksSkipped.length,
        queuedServices: tasksQueued,
        skippedServices: tasksSkipped,
        maintenanceServicesList: maintenanceServices,
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
