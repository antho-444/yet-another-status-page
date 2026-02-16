import type { BasePayload } from 'payload'
import { performHealthCheck, determineServiceStatus } from '@/lib/monitoring'
import type { Service } from '@/payload-types'

export interface CheckServiceHealthInput {
  serviceId: string // Payload job inputs are always strings, convert to number internally
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
    // Convert serviceId string to number
    const serviceIdNum = parseInt(serviceId, 10)
    if (isNaN(serviceIdNum)) {
      return {
        output: {
          success: false,
          message: 'Invalid serviceId',
        },
      }
    }

    // Fetch the service
    const service = await payload.findByID({
      collection: 'services',
      id: serviceIdNum,
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
    if (!service.monitoring.url && !service.monitoring.host) {
      return {
        output: {
          success: false,
          message: 'No monitoring URL or host configured',
        },
      }
    }

    // Build monitoring config based on type
    const monitoringType = service.monitoring.type || 'http'
    const checkConfig: any = {
      type: monitoringType,
      timeout: (service.monitoring.timeout || 10) * 1000, // Convert to milliseconds
    }

    // Add type-specific configuration
    if (monitoringType === 'http') {
      if (!service.monitoring.url) {
        return {
          output: {
            success: false,
            message: 'No monitoring URL configured for HTTP monitoring',
          },
        }
      }
      checkConfig.url = service.monitoring.url
      checkConfig.method = service.monitoring.method || 'GET'
      checkConfig.expectedStatusCode = service.monitoring.expectedStatusCode || 200
    } else if (monitoringType === 'tcp') {
      if (!service.monitoring.host || !service.monitoring.port) {
        return {
          output: {
            success: false,
            message: 'Host and port are required for TCP monitoring',
          },
        }
      }
      checkConfig.host = service.monitoring.host
      checkConfig.port = service.monitoring.port
    } else if (monitoringType === 'ping') {
      if (!service.monitoring.host) {
        return {
          output: {
            success: false,
            message: 'Host is required for Ping monitoring',
          },
        }
      }
      checkConfig.host = service.monitoring.host
    } else if (monitoringType === 'gamedig') {
      if (!service.monitoring.host || !service.monitoring.gameType) {
        return {
          output: {
            success: false,
            message: 'Host and game type are required for GameDig monitoring',
          },
        }
      }
      checkConfig.host = service.monitoring.host
      checkConfig.port = service.monitoring.port
      checkConfig.gameType = service.monitoring.gameType
    }

    // Perform health check
    const checkResult = await performHealthCheck(checkConfig)

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
      id: serviceIdNum,
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
