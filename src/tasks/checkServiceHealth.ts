import type { BasePayload } from 'payload'
import { performHealthCheck, determineServiceStatus } from '@/lib/monitoring'
import type { Service } from '@/payload-types'

export interface CheckServiceHealthInput {
  serviceId: number
}

interface TaskHandlerArgs {
  input: CheckServiceHealthInput
  req: {
    payload: BasePayload
  }
}

/**
 * Task handler for checking service health
 * This handler is executed periodically to monitor services
 */
export async function checkServiceHealthHandler({ input, req }: TaskHandlerArgs) {
  const { payload } = req
  const { serviceId } = input

  try {
    // Fetch the service
    const service = await payload.findByID({
      collection: 'services',
      id: serviceId,
    }) as Service

    // Check if monitoring is enabled
    if (!service.monitoring?.enabled) {
      return {
        output: {
          success: false,
          message: 'Monitoring is not enabled for this service',
        },
      }
    }

    // Validate monitoring configuration
    if (!service.monitoring.url) {
      return {
        output: {
          success: false,
          message: 'No monitoring URL configured',
        },
      }
    }

    // Perform health check
    const checkResult = await performHealthCheck({
      url: service.monitoring.url,
      method: service.monitoring.method as 'GET' | 'HEAD' | 'POST' | undefined,
      timeout: (service.monitoring.timeout || 10) * 1000, // Convert to milliseconds
      expectedStatusCode: service.monitoring.expectedStatusCode || 200,
    })

    // Update consecutive failures
    const previousFailures = service.monitoring.consecutiveFailures || 0
    const newFailures = checkResult.success ? 0 : previousFailures + 1

    // Determine new service status
    const failureThreshold = service.monitoring.failureThreshold || 3
    const newStatus = determineServiceStatus(newFailures, failureThreshold)

    // Only update status if it changed and we have enough failures
    const shouldUpdateStatus = 
      service.status !== newStatus && 
      (checkResult.success || newFailures >= failureThreshold)

    // Update service with check results
    const updateData: any = {
      monitoring: {
        ...service.monitoring,
        lastCheckedAt: new Date().toISOString(),
        lastCheckStatus: checkResult.success ? 'success' : 'failed',
        consecutiveFailures: newFailures,
      },
    }

    // Update status if needed
    if (shouldUpdateStatus) {
      updateData.status = newStatus
    }

    await payload.update({
      collection: 'services',
      id: serviceId,
      data: updateData,
    })

    return {
      output: {
        success: true,
        checkResult,
        consecutiveFailures: newFailures,
        statusChanged: shouldUpdateStatus,
        newStatus: shouldUpdateStatus ? newStatus : service.status,
      },
    }
  } catch (error: any) {
    console.error('Error checking service health:', error)
    return {
      output: {
        success: false,
        message: error.message || 'Unknown error',
      },
    }
  }
}
