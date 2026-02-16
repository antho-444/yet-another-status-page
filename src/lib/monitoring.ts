/**
 * Service monitoring utilities
 * Provides health check functionality for monitoring service endpoints
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import * as net from 'net'

const execAsync = promisify(exec)

export interface MonitoringCheckResult {
  success: boolean
  statusCode?: number
  responseTime?: number
  error?: string
  details?: string
}

export interface MonitoringConfig {
  type: 'http' | 'tcp' | 'ping' | 'gamedig'
  // HTTP specific
  url?: string
  method?: 'GET' | 'HEAD' | 'POST'
  expectedStatusCode?: number
  // TCP/Ping/GameDig specific
  host?: string
  port?: number
  // GameDig specific
  gameType?: string
  // Common
  timeout?: number
}

/**
 * Perform a health check on a service based on monitoring type
 * @param config Monitoring configuration
 * @returns Check result with success status and details
 */
export async function performHealthCheck(
  config: MonitoringConfig
): Promise<MonitoringCheckResult> {
  switch (config.type) {
    case 'http':
      return performHttpCheck(config)
    case 'tcp':
      return performTcpCheck(config)
    case 'ping':
      return performPingCheck(config)
    case 'gamedig':
      return performGameDigCheck(config)
    default:
      return {
        success: false,
        error: `Unknown monitoring type: ${config.type}`,
      }
  }
}

/**
 * Perform HTTP/HTTPS health check
 */
async function performHttpCheck(
  config: MonitoringConfig
): Promise<MonitoringCheckResult> {
  const {
    url,
    method = 'GET',
    timeout = 10000,
    expectedStatusCode = 200,
  } = config

  if (!url) {
    return {
      success: false,
      error: 'URL is required for HTTP monitoring',
    }
  }

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
        // Don't follow redirects - check the actual response
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
 * Perform TCP port check
 */
async function performTcpCheck(
  config: MonitoringConfig
): Promise<MonitoringCheckResult> {
  const { host, port, timeout = 10000 } = config

  if (!host || !port) {
    return {
      success: false,
      error: 'Host and port are required for TCP monitoring',
    }
  }

  const startTime = Date.now()

  return new Promise((resolve) => {
    const socket = new net.Socket()
    let connected = false

    const timeoutId = setTimeout(() => {
      if (!connected) {
        socket.destroy()
        resolve({
          success: false,
          responseTime: Date.now() - startTime,
          error: `Connection timeout after ${timeout}ms`,
        })
      }
    }, timeout)

    socket.connect(port, host, () => {
      connected = true
      clearTimeout(timeoutId)
      socket.destroy()
      resolve({
        success: true,
        responseTime: Date.now() - startTime,
        details: `TCP port ${port} is open`,
      })
    })

    socket.on('error', (error: any) => {
      connected = true
      clearTimeout(timeoutId)
      socket.destroy()
      resolve({
        success: false,
        responseTime: Date.now() - startTime,
        error: error.message || 'Connection failed',
      })
    })
  })
}

/**
 * Perform Ping (ICMP) check
 */
async function performPingCheck(
  config: MonitoringConfig
): Promise<MonitoringCheckResult> {
  const { host, timeout = 10000 } = config

  if (!host) {
    return {
      success: false,
      error: 'Host is required for Ping monitoring',
    }
  }

  const startTime = Date.now()

  try {
    // Use system ping command
    // -c 1: send 1 packet
    // -W: timeout in seconds
    const timeoutSec = Math.ceil(timeout / 1000)
    const { stdout, stderr } = await execAsync(
      `ping -c 1 -W ${timeoutSec} ${host}`,
      { timeout }
    )

    const responseTime = Date.now() - startTime

    // Check if ping was successful
    if (stdout.includes('1 received') || stdout.includes('1 packets received')) {
      // Extract time from ping output
      const timeMatch = stdout.match(/time[=:]?\s*([0-9.]+)\s*ms/i)
      const pingTime = timeMatch ? parseFloat(timeMatch[1]) : responseTime

      return {
        success: true,
        responseTime: pingTime,
        details: `Host is reachable`,
      }
    } else {
      return {
        success: false,
        responseTime,
        error: 'Host unreachable or packet lost',
      }
    }
  } catch (error: any) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      error: error.message || 'Ping failed',
    }
  }
}

/**
 * Perform GameDig game server check
 */
async function performGameDigCheck(
  config: MonitoringConfig
): Promise<MonitoringCheckResult> {
  const { host, port, gameType, timeout = 10000 } = config

  if (!host || !gameType) {
    return {
      success: false,
      error: 'Host and game type are required for GameDig monitoring',
    }
  }

  const startTime = Date.now()

  try {
    // Dynamically import gamedig only when needed
    const { GameDig } = await import('gamedig')
    
    const state = await GameDig.query({
      type: gameType,
      host: host,
      port: port,
      socketTimeout: timeout,
      attemptTimeout: timeout,
    })

    const responseTime = Date.now() - startTime

    return {
      success: true,
      responseTime,
      details: `Server online - ${state.players?.length || 0}/${state.maxplayers || 0} players`,
    }
  } catch (error: any) {
    // If gamedig is not installed, provide a helpful error
    if (error.code === 'MODULE_NOT_FOUND') {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: 'GameDig module not installed. Install with: npm install gamedig',
      }
    }

    return {
      success: false,
      responseTime: Date.now() - startTime,
      error: error.message || 'Game server query failed',
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
