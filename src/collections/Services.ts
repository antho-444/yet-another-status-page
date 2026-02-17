import type { CollectionConfig } from 'payload'
import { standardAccess } from '@/lib/access'

export const serviceStatusOptions = [
  { label: 'Operational', value: 'operational' },
  { label: 'Degraded Performance', value: 'degraded' },
  { label: 'Partial Outage', value: 'partial' },
  { label: 'Major Outage', value: 'major' },
  { label: 'Under Maintenance', value: 'maintenance' },
] as const

export type ServiceStatus = (typeof serviceStatusOptions)[number]['value']

export const Services: CollectionConfig = {
  slug: 'services',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'group', 'status', 'updatedAt'],
    group: 'Status',
  },
  orderable: true,
  access: standardAccess,
  hooks: {
    afterChange: [
      async ({ doc, req, operation }) => {
        // Only queue health check on update (not create) and if monitoring is enabled
        if (operation === 'update' && doc.monitoring?.enabled) {
          console.log(`[Services Hook] Service "${doc.name}" saved with monitoring enabled`)
          console.log(`[Services Hook] Queuing health check job...`)
          
          try {
            // Queue the health check task (will be processed by scheduler)
            await req.payload.jobs.queue({
              task: 'checkServiceHealth',
              input: {
                serviceId: String(doc.id),
              },
            })

            console.log(`[Services Hook] Health check job queued for service "${doc.name}"`)
            console.log(`[Services Hook] Job will be processed by the monitoring scheduler`)
          } catch (error: any) {
            console.error(`[Services Hook] Failed to queue health check:`, error.message)
          }
        } else if (operation === 'create' && doc.monitoring?.enabled) {
          console.log(`[Services Hook] Service "${doc.name}" created with monitoring enabled`)
          console.log(`[Services Hook] Health check will run on next scheduled interval`)
        }
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Service Name',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'URL-friendly identifier (e.g., "api-gateway")',
      },
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            if (!value && data?.name) {
              return data.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '')
            }
            return value
          },
        ],
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Description',
      admin: {
        description: 'Optional description for this service',
      },
    },
    {
      name: 'group',
      type: 'relationship',
      relationTo: 'service-groups',
      required: true,
      label: 'Service Group',
      admin: {
        description: 'Which group this service belongs to',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'operational',
      options: [...serviceStatusOptions],
      admin: {
        description: 'Current status of the service',
      },
    },
    {
      name: 'monitoring',
      type: 'group',
      label: 'Monitoring Configuration',
      admin: {
        description: 'Configure automatic monitoring for this service',
      },
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          label: 'Enable Automatic Monitoring',
          defaultValue: false,
          admin: {
            description: 'When enabled, the service will be automatically checked at the specified interval',
          },
        },
        {
          name: 'type',
          type: 'select',
          label: 'Monitoring Type',
          defaultValue: 'http',
          options: [
            { label: 'HTTP/HTTPS', value: 'http' },
            { label: 'TCP Port', value: 'tcp' },
            { label: 'Ping (ICMP)', value: 'ping' },
            { label: 'Game Server (GameDig)', value: 'gamedig' },
          ],
          admin: {
            description: 'Type of monitoring to perform',
            condition: (data, siblingData) => siblingData?.enabled === true,
          },
        },
        {
          name: 'url',
          type: 'text',
          label: 'Monitor URL',
          admin: {
            description: 'The URL to monitor (e.g., https://api.example.com/health)',
            condition: (data, siblingData) => siblingData?.enabled === true && siblingData?.type === 'http',
          },
        },
        {
          name: 'method',
          type: 'select',
          label: 'HTTP Method',
          defaultValue: 'GET',
          options: [
            { label: 'GET', value: 'GET' },
            { label: 'HEAD', value: 'HEAD' },
            { label: 'POST', value: 'POST' },
          ],
          admin: {
            description: 'HTTP method to use for the health check',
            condition: (data, siblingData) => siblingData?.enabled === true && siblingData?.type === 'http',
          },
        },
        {
          name: 'host',
          type: 'text',
          label: 'Hostname or IP',
          admin: {
            description: 'Hostname or IP address to monitor (e.g., example.com or 192.168.1.1)',
            condition: (data, siblingData) => siblingData?.enabled === true && ['tcp', 'ping', 'gamedig'].includes(siblingData?.type),
          },
        },
        {
          name: 'port',
          type: 'number',
          label: 'Port Number',
          admin: {
            description: 'Port number to check (e.g., 22 for SSH, 3306 for MySQL)',
            condition: (data, siblingData) => siblingData?.enabled === true && ['tcp', 'gamedig'].includes(siblingData?.type),
          },
        },
        {
          name: 'gameType',
          type: 'select',
          label: 'Game Type',
          options: [
            { label: 'Minecraft', value: 'minecraft' },
            { label: 'Counter-Strike', value: 'cs' },
            { label: 'Team Fortress 2', value: 'tf2' },
            { label: 'Garry\'s Mod', value: 'garrysmod' },
            { label: 'ARK: Survival Evolved', value: 'arkse' },
            { label: 'Rust', value: 'rust' },
            { label: '7 Days to Die', value: '7d2d' },
            { label: 'Valheim', value: 'valheim' },
          ],
          admin: {
            description: 'Type of game server',
            condition: (data, siblingData) => siblingData?.enabled === true && siblingData?.type === 'gamedig',
          },
        },
        {
          name: 'interval',
          type: 'number',
          label: 'Check Interval (seconds)',
          defaultValue: 60,
          min: 30,
          max: 3600,
          admin: {
            description: 'How often to check the service (minimum 30 seconds)',
            condition: (data, siblingData) => siblingData?.enabled === true,
          },
        },
        {
          name: 'timeout',
          type: 'number',
          label: 'Timeout (seconds)',
          defaultValue: 10,
          min: 1,
          max: 60,
          admin: {
            description: 'Request timeout in seconds',
            condition: (data, siblingData) => siblingData?.enabled === true,
          },
        },
        {
          name: 'expectedStatusCode',
          type: 'number',
          label: 'Expected HTTP Status Code',
          defaultValue: 200,
          admin: {
            description: 'The expected HTTP status code for a healthy response (default: 200)',
            condition: (data, siblingData) => siblingData?.enabled === true && siblingData?.type === 'http',
          },
        },
        {
          name: 'lastCheckedAt',
          type: 'date',
          label: 'Last Checked At',
          admin: {
            readOnly: true,
            description: 'Timestamp of the last monitoring check',
            condition: (data, siblingData) => siblingData?.enabled === true,
          },
        },
        {
          name: 'lastCheckStatus',
          type: 'select',
          label: 'Last Check Status',
          options: [
            { label: 'Success', value: 'success' },
            { label: 'Failed', value: 'failed' },
            { label: 'Pending', value: 'pending' },
          ],
          admin: {
            readOnly: true,
            description: 'Result of the last monitoring check',
            condition: (data, siblingData) => siblingData?.enabled === true,
          },
        },
        {
          name: 'consecutiveFailures',
          type: 'number',
          label: 'Consecutive Failures',
          defaultValue: 0,
          admin: {
            readOnly: true,
            description: 'Number of consecutive failed checks',
            condition: (data, siblingData) => siblingData?.enabled === true,
          },
        },
        {
          name: 'failureThreshold',
          type: 'number',
          label: 'Failure Threshold',
          defaultValue: 3,
          min: 1,
          max: 10,
          admin: {
            description: 'Number of consecutive failures before marking service as down',
            condition: (data, siblingData) => siblingData?.enabled === true,
          },
        },
      ],
    },
  ],
}
