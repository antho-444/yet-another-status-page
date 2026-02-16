import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * POST /api/monitoring/check
 * Manually trigger a health check for a specific service
 * 
 * Body: { serviceId: string }
 */
export async function POST(request: Request) {
  try {
    const payload = await getPayload({ config })
    const body = await request.json()
    const { serviceId } = body

    if (!serviceId) {
      return NextResponse.json(
        { error: 'serviceId is required' },
        { status: 400 }
      )
    }

    // Verify service exists
    const service = await payload.findByID({
      collection: 'services',
      id: serviceId,
    })

    if (!service) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      )
    }

    // Queue the health check task
    await payload.jobs.queue({
      task: 'checkServiceHealth',
      input: {
        serviceId,
      },
    })

    return NextResponse.json({
      message: 'Health check queued successfully',
      serviceId,
      serviceName: service.name,
    })
  } catch (error: any) {
    console.error('Monitoring check error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to queue health check' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/monitoring/check
 * Trigger monitoring checks for all services that need checking
 */
export async function GET() {
  try {
    const payload = await getPayload({ config })

    // Queue the scheduled monitoring task
    const job = await payload.jobs.queue({
      task: 'scheduleMonitoringChecks',
      input: {},
    })

    return NextResponse.json({
      message: 'Monitoring checks scheduled successfully',
      jobId: job.id,
    })
  } catch (error: any) {
    console.error('Monitoring schedule error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to schedule monitoring checks' },
      { status: 500 }
    )
  }
}
