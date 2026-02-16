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
  console.log(`[Monitor] ========================================`)
  console.log(`[Monitor] Starting ${config.type} health check`)
  console.log(`[Monitor] ========================================`)
  
  let result: MonitoringCheckResult
  
  switch (config.type) {
    case 'http':
      result = await performHttpCheck(config)
      break
    case 'tcp':
      result = await performTcpCheck(config)
      break
    case 'ping':
      result = await performPingCheck(config)
      break
    case 'gamedig':
      result = await performGameDigCheck(config)
      break
    default:
      result = {
        success: false,
        error: `Unknown monitoring type: ${config.type}`,
      }
  }
  
  console.log(`[Monitor] ========================================`)
  console.log(`[Monitor] Check complete: ${result.success ? 'SUCCESS' : 'FAILURE'}`)
  if (result.error) {
    console.log(`[Monitor] Error: ${result.error}`)
  }
  if (result.responseTime) {
    console.log(`[Monitor] Response time: ${result.responseTime}ms`)
  }
  console.log(`[Monitor] ========================================`)
  
  return result
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

  // Debug logging
  console.log(`[HTTP Monitor] Starting check for ${url}`)
  console.log(`[HTTP Monitor] Method: ${method}, Expected: ${expectedStatusCode}, Timeout: ${timeout}ms`)

  try {
    // Validate URL
    const parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      console.error(`[HTTP Monitor] Invalid protocol: ${parsedUrl.protocol}`)
      return {
        success: false,
        error: 'Invalid URL protocol. Only HTTP and HTTPS are supported.',
      }
    }

    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      console.log(`[HTTP Monitor] Fetching ${url}...`)
      const response = await fetch(url, {
        method,
        signal: controller.signal,
        // Follow redirects by default (most URLs redirect http -> https)
        // This allows monitoring sites like google.com that redirect to https://www.google.com
        redirect: 'follow',
        headers: {
          'User-Agent': 'Yet-Another-Status-Page-Monitor/1.0',
        },
      })

      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime

      console.log(`[HTTP Monitor] Response: ${response.status} ${response.statusText}`)
      console.log(`[HTTP Monitor] Response time: ${responseTime}ms`)
      console.log(`[HTTP Monitor] Final URL: ${response.url}`)

      // Check if status code matches expected
      const success = response.status === expectedStatusCode

      const result = {
        success,
        statusCode: response.status,
        responseTime,
        error: success ? undefined : `Expected status ${expectedStatusCode}, got ${response.status}`,
      }

      console.log(`[HTTP Monitor] Result: ${success ? 'SUCCESS' : 'FAILURE'}`)
      if (!success) {
        console.error(`[HTTP Monitor] Error: ${result.error}`)
      }

      return result
    } catch (error: any) {
      clearTimeout(timeoutId)

      if (error.name === 'AbortError') {
        console.error(`[HTTP Monitor] Request timeout after ${timeout}ms`)
        return {
          success: false,
          responseTime: Date.now() - startTime,
          error: `Request timeout after ${timeout}ms`,
        }
      }

      throw error
    }
  } catch (error: any) {
    console.error(`[HTTP Monitor] Exception: ${error.message}`)
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

  // Debug logging
  console.log(`[TCP Monitor] Starting check for ${host}:${port}`)
  console.log(`[TCP Monitor] Timeout: ${timeout}ms`)

  return new Promise((resolve) => {
    const socket = new net.Socket()
    let connected = false

    const timeoutId = setTimeout(() => {
      if (!connected) {
        socket.destroy()
        console.error(`[TCP Monitor] Connection timeout after ${timeout}ms`)
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
      const responseTime = Date.now() - startTime
      console.log(`[TCP Monitor] Connection successful to ${host}:${port}`)
      console.log(`[TCP Monitor] Response time: ${responseTime}ms`)
      resolve({
        success: true,
        responseTime,
        details: `TCP port ${port} is open`,
      })
    })

    socket.on('error', (error: any) => {
      connected = true
      clearTimeout(timeoutId)
      socket.destroy()
      console.error(`[TCP Monitor] Connection failed to ${host}:${port}: ${error.message}`)
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

  // Debug logging
  console.log(`[Ping Monitor] Starting check for ${host}`)
  console.log(`[Ping Monitor] Timeout: ${timeout}ms`)

  try {
    // Use system ping command
    // -c 1: send 1 packet
    // -W: timeout in seconds
    const timeoutSec = Math.ceil(timeout / 1000)
    console.log(`[Ping Monitor] Executing: ping -c 1 -W ${timeoutSec} ${host}`)
    const { stdout, stderr } = await execAsync(
      `ping -c 1 -W ${timeoutSec} ${host}`,
      { timeout }
    )

    const responseTime = Date.now() - startTime

    console.log(`[Ping Monitor] Stdout: ${stdout.substring(0, 200)}`)
    if (stderr) {
      console.log(`[Ping Monitor] Stderr: ${stderr}`)
    }

    // Check if ping was successful
    if (stdout.includes('1 received') || stdout.includes('1 packets received')) {
      // Extract time from ping output
      const timeMatch = stdout.match(/time[=:]?\s*([0-9.]+)\s*ms/i)
      const pingTime = timeMatch ? parseFloat(timeMatch[1]) : responseTime

      console.log(`[Ping Monitor] Ping successful, time: ${pingTime}ms`)
      return {
        success: true,
        responseTime: pingTime,
        details: `Host is reachable`,
      }
    } else {
      console.error(`[Ping Monitor] Host unreachable`)
      return {
        success: false,
        responseTime,
        error: 'Host unreachable or packet lost',
      }
    }
  } catch (error: any) {
    console.error(`[Ping Monitor] Exception: ${error.message}`)
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

  // Debug logging
  console.log(`[GameDig Monitor] Starting check for ${host}:${port} (${gameType})`)
  console.log(`[GameDig Monitor] Timeout: ${timeout}ms`)

  try {
    // Dynamically import gamedig only when needed
    const { GameDig } = await import('gamedig')
    
    console.log(`[GameDig Monitor] Querying game server...`)
    const state = await GameDig.query({
      type: gameType,
      host: host,
      port: port,
      socketTimeout: timeout,
      attemptTimeout: timeout,
    })

    const responseTime = Date.now() - startTime

    console.log(`[GameDig Monitor] Server: ${state.name}`)
    console.log(`[GameDig Monitor] Players: ${state.players?.length || 0}/${state.maxplayers || 0}`)
    console.log(`[GameDig Monitor] Map: ${state.map}`)
    console.log(`[GameDig Monitor] Response time: ${responseTime}ms`)

    return {
      success: true,
      responseTime,
      details: `Server online - ${state.players?.length || 0}/${state.maxplayers || 0} players`,
    }
  } catch (error: any) {
    // If gamedig is not installed, provide a helpful error
    if (error.code === 'MODULE_NOT_FOUND') {
      console.error(`[GameDig Monitor] GameDig module not installed`)
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: 'GameDig module not installed. Install with: npm install gamedig',
      }
    }

    console.error(`[GameDig Monitor] Query failed: ${error.message}`)
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
