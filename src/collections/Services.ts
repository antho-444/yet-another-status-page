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
          name: 'url',
          type: 'text',
          label: 'Monitor URL',
          admin: {
            description: 'The URL to monitor (e.g., https://api.example.com/health)',
            condition: (data, siblingData) => siblingData?.enabled === true,
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
            condition: (data, siblingData) => siblingData?.enabled === true,
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
            condition: (data, siblingData) => siblingData?.enabled === true,
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
