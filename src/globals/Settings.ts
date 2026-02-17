import type { GlobalConfig } from 'payload'

export const Settings: GlobalConfig = {
  slug: 'settings',
  label: 'Site Settings',
  admin: {
    group: 'Configuration',
  },
  access: {
    read: () => true,
  },
  hooks: {
    beforeChange: [
      async ({ data }) => {
        // Auto-generate cron expression from user-friendly inputs
        if (data.monitoringEnabled && data.monitoringScheduleType && data.monitoringScheduleInterval) {
          const interval = data.monitoringScheduleInterval
          const type = data.monitoringScheduleType

          let cronExpression = ''
          
          switch (type) {
            case 'minutes':
              if (interval === 1) {
                cronExpression = '* * * * *' // Every minute
              } else if (interval <= 30) {
                cronExpression = `*/${interval} * * * *` // Every N minutes
              } else {
                cronExpression = `0 * * * *` // Fall back to hourly if > 30 minutes
              }
              break
            case 'hours':
              if (interval === 1) {
                cronExpression = '0 * * * *' // Every hour
              } else if (interval <= 23) {
                cronExpression = `0 */${interval} * * *` // Every N hours
              } else {
                cronExpression = '0 0 * * *' // Fall back to daily if >= 24 hours
              }
              break
            case 'days':
              if (interval === 1) {
                cronExpression = '0 0 * * *' // Every day at midnight
              } else if (interval <= 30) {
                cronExpression = `0 0 */${interval} * *` // Every N days
              } else {
                cronExpression = '0 0 1 * *' // Fall back to monthly
              }
              break
            case 'weeks':
              if (interval === 1) {
                cronExpression = '0 0 * * 0' // Every Sunday at midnight
              } else {
                cronExpression = '0 0 * * 0' // Weekly on Sunday
              }
              break
          }

          // Only update if not manually overridden or empty
          if (!data.monitoringScheduleCron || data.monitoringScheduleCron.trim() === '') {
            data.monitoringScheduleCron = cronExpression
          }
        }

        return data
      },
    ],
  },
  fields: [
    // General Settings
    {
      type: 'collapsible',
      label: 'General',
      admin: {
        initCollapsed: false,
      },
      fields: [
        {
          name: 'siteName',
          type: 'text',
          required: true,
          defaultValue: 'Status Page',
          label: 'Site Name',
          admin: {
            description: 'The name of your organization/site',
          },
        },
        {
          name: 'siteDescription',
          type: 'textarea',
          label: 'Site Description',
          admin: {
            description: 'A brief description of your status page',
          },
        },
        {
          name: 'footerText',
          type: 'richText',
          label: 'Footer Text',
          admin: {
            description: 'Text displayed in the footer. Supports bold, italic, underline, and links. Leave empty for default.',
          },
        },
      ],
    },
    // SEO Settings
    {
      type: 'collapsible',
      label: 'SEO',
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'metaTitle',
          type: 'text',
          label: 'Meta Title',
          admin: {
            description: 'Title shown in browser tabs and search results (leave empty to use Site Name)',
          },
        },
        {
          name: 'metaDescription',
          type: 'textarea',
          label: 'Meta Description',
          admin: {
            description: 'Description shown in search results',
          },
        },
        {
          name: 'historyMetaTitle',
          type: 'text',
          label: 'History Page Meta Title',
          admin: {
            description: 'Title for the incident history page (use {{date}} for dynamic date)',
          },
        },
        {
          name: 'historyMetaDescription',
          type: 'textarea',
          label: 'History Page Meta Description',
          admin: {
            description: 'Description for the incident history page (use {{date}} for dynamic date)',
          },
        },
      ],
    },
    // Branding Settings
    {
      type: 'collapsible',
      label: 'Branding',
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'favicon',
          type: 'upload',
          relationTo: 'media',
          label: 'Favicon',
          admin: {
            description: 'Site favicon (recommended: 32x32 or 64x64 PNG, ICO, or SVG). Leave empty to use default favicon.',
          },
        },
        {
          name: 'logoLight',
          type: 'upload',
          relationTo: 'media',
          label: 'Logo (Light Theme)',
          admin: {
            description: 'Logo to display on light backgrounds (recommended: SVG or PNG with transparent background)',
          },
        },
        {
          name: 'logoDark',
          type: 'upload',
          relationTo: 'media',
          label: 'Logo (Dark Theme)',
          admin: {
            description: 'Logo to display on dark backgrounds (recommended: SVG or PNG with transparent background)',
          },
        },
      ],
    },
    // Monitoring Settings
    {
      type: 'collapsible',
      label: 'Monitoring Schedule',
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'monitoringEnabled',
          type: 'checkbox',
          defaultValue: true,
          label: 'Enable Automatic Monitoring',
          admin: {
            description: 'Enable automatic health checks for services (requires application restart to take effect)',
          },
        },
        {
          name: 'monitoringScheduleType',
          type: 'select',
          label: 'Check Frequency',
          defaultValue: 'minutes',
          options: [
            { label: 'Minutes', value: 'minutes' },
            { label: 'Hours', value: 'hours' },
            { label: 'Days', value: 'days' },
            { label: 'Weeks', value: 'weeks' },
          ],
          admin: {
            description: 'How often to run health checks',
            condition: (data) => data?.monitoringEnabled !== false,
          },
        },
        {
          name: 'monitoringScheduleInterval',
          type: 'number',
          label: 'Interval',
          defaultValue: 1,
          min: 1,
          max: 60,
          admin: {
            description: 'Number of minutes/hours/days/weeks between checks',
            condition: (data) => data?.monitoringEnabled !== false,
          },
        },
        {
          name: 'monitoringScheduleCron',
          type: 'text',
          label: 'Cron Expression (Advanced)',
          admin: {
            description: 'Current cron schedule (auto-generated from interval settings). You can manually override this for advanced scheduling.',
            readOnly: false,
            condition: (data) => data?.monitoringEnabled !== false,
          },
        },
      ],
    },
    // Status Override Settings
    {
      type: 'collapsible',
      label: 'Status Override',
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'maintenanceModeEnabled',
          type: 'checkbox',
          defaultValue: false,
          label: 'Enable Maintenance Mode',
          admin: {
            description: 'Force display of maintenance banner regardless of service status',
          },
        },
        {
          name: 'customStatusMessage',
          type: 'textarea',
          label: 'Custom Status Message',
          admin: {
            description: 'Override the default status banner message (leave empty to use automatic)',
          },
        },
      ],
    },
  ],
}
