/**
 * Service monitoring utilities
 * Provides health check functionality for monitoring service endpoints
 */

export interface MonitoringCheckResult {
  success: boolean
  statusCode?: number
  responseTime?: number
  error?: string
}

export interface MonitoringConfig {
  url: string
  method?: 'GET' | 'HEAD' | 'POST'
  timeout?: number
  expectedStatusCode?: number
}

/**
 * Perform a health check on a service endpoint
 * @param config Monitoring configuration
 * @returns Check result with success status, status code, and response time
 */
export async function performHealthCheck(
  config: MonitoringConfig
): Promise<MonitoringCheckResult> {
  const {
    url,
    method = 'GET',
    timeout = 10000,
    expectedStatusCode = 200,
  } = config

  const startTime = Date.now()

  try {
    // Validate URL
    const parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return {
        success: false,
        error: 'Invalid URL protocol. Only HTTP and HTTPS are supported.',
      }
    }

    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        method,
        signal: controller.signal,
        // Don't follow redirects automatically, check the actual response
        redirect: 'manual',
        headers: {
          'User-Agent': 'Yet-Another-Status-Page-Monitor/1.0',
        },
      })

      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime

      // Check if status code matches expected
      const success = response.status === expectedStatusCode

      return {
        success,
        statusCode: response.status,
        responseTime,
        error: success ? undefined : `Expected status ${expectedStatusCode}, got ${response.status}`,
      }
    } catch (error: any) {
      clearTimeout(timeoutId)

      if (error.name === 'AbortError') {
        return {
          success: false,
          responseTime: Date.now() - startTime,
          error: `Request timeout after ${timeout}ms`,
        }
      }

      throw error
    }
  } catch (error: any) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      error: error.message || 'Unknown error occurred',
    }
  }
}

/**
 * Determine the appropriate service status based on consecutive failures
 * @param consecutiveFailures Number of consecutive failed checks
 * @param failureThreshold Threshold for marking service as down
 * @returns Suggested service status
 */
export function determineServiceStatus(
  consecutiveFailures: number,
  failureThreshold: number
): 'operational' | 'degraded' | 'major' {
  if (consecutiveFailures === 0) {
    return 'operational'
  } else if (consecutiveFailures < failureThreshold) {
    return 'degraded'
  } else {
    return 'major'
  }
}
