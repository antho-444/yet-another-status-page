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

  console.log(`\n====================================================================`)
  console.log(`[Task] Health Check Handler - Service ID: ${serviceId}`)
  console.log(`[Task] Timestamp: ${new Date().toISOString()}`)
  console.log(`====================================================================\n`)

  try {
    // Convert serviceId string to number
    const serviceIdNum = parseInt(serviceId, 10)
    if (isNaN(serviceIdNum)) {
      console.error(`[Task] Invalid serviceId: ${serviceId}`)
      return {
        output: {
          success: false,
          message: 'Invalid serviceId',
        },
      }
    }

    // Fetch the service
    console.log(`[Task] Fetching service ${serviceIdNum} from database...`)
    const service = await payload.findByID({
      collection: 'services',
      id: serviceIdNum,
    }) as Service

    console.log(`[Task] Service found: ${service.name}`)

    // Check if monitoring is enabled
    if (!service.monitoring?.enabled) {
      console.warn(`[Task] Monitoring is not enabled for service: ${service.name}`)
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

    console.log(`[Task] Built monitoring config:`, JSON.stringify(checkConfig, null, 2))

    // Perform health check
    const checkResult = await performHealthCheck(checkConfig)

    console.log(`[Task] Health check result:`, JSON.stringify(checkResult, null, 2))

    // Update consecutive failures
    const previousFailures = service.monitoring.consecutiveFailures || 0
    const newFailures = checkResult.success ? 0 : previousFailures + 1

    console.log(`[Task] Previous failures: ${previousFailures}, New failures: ${newFailures}`)

    // Determine new service status
    const failureThreshold = service.monitoring.failureThreshold || 3
    const newStatus = determineServiceStatus(newFailures, failureThreshold)

    console.log(`[Task] Current status: ${service.status}, New status: ${newStatus}`)

    // Only update status if it changed and we have enough failures
    const shouldUpdateStatus = 
      service.status !== newStatus && 
      (checkResult.success || newFailures >= failureThreshold)

    console.log(`[Task] Should update status: ${shouldUpdateStatus}`)

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
      console.log(`[Task] Updating service status from ${service.status} to ${newStatus}`)
    }

    console.log(`[Task] Updating service in database...`)
    await payload.update({
      collection: 'services',
      id: serviceIdNum,
      data: updateData,
    })

    console.log(`[Task] Service updated successfully`)
    console.log(`\n====================================================================`)
    console.log(`[Task] Health Check Complete`)
    console.log(`[Task] Result: ${checkResult.success ? 'SUCCESS' : 'FAILURE'}`)
    console.log(`[Task] Status: ${shouldUpdateStatus ? `Changed to ${newStatus}` : `Unchanged (${service.status})`}`)
    console.log(`====================================================================\n`)

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
