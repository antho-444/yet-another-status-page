import { postgresAdapter } from '@payloadcms/db-postgres'
import {
  BoldFeature,
  FixedToolbarFeature,
  ItalicFeature,
  lexicalEditor,
  LinkFeature,
  ParagraphFeature,
  StrikethroughFeature,
  UnderlineFeature,
} from '@payloadcms/richtext-lexical'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import path from 'path'
import { buildConfig, Plugin } from 'payload'
import { fileURLToPath } from 'url'

// Collections
import {
  Incidents,
  Maintenances,
  Media,
  Notifications,
  ServiceGroups,
  Services,
  Subscribers,
  Users,
} from '@/collections'

// Globals
import { EmailSettings, Settings, SmsSettings } from '@/globals'

// Tasks
import { sendNotificationFromCollectionHandler } from '@/tasks/sendNotificationFromCollection'
import { checkServiceHealthHandler } from '@/tasks/checkServiceHealth'
import { scheduleMonitoringChecksHandler } from '@/tasks/scheduleMonitoringChecks'

// Migrations
import { migrations } from '@/migrations'

// Monitoring Scheduler
import { startMonitoringScheduler } from '@/lib/monitoringScheduler'

// Optional OIDC/SSO
import { getOIDCPlugin, isOIDCPartiallyConfigured } from '@/lib/oidc'

// Utils
import { getServerUrl } from '@/lib/utils'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Build plugins array (OIDC is optional)
const plugins: Plugin[] = []
const oidcPlugin = getOIDCPlugin()
if (oidcPlugin) {
  plugins.push(oidcPlugin)
  console.log('OIDC SSO enabled')
} else if (isOIDCPartiallyConfigured()) {
  console.warn('OIDC configuration incomplete - some OIDC_* env vars are set but not all required ones. SSO disabled.')
}

const isVercelBlobEnabled = !!process.env.BLOB_READ_WRITE_TOKEN
plugins.push(
  vercelBlobStorage({
    enabled: isVercelBlobEnabled,
    collections: {
      media: true,
    },
    token: process.env.BLOB_READ_WRITE_TOKEN || 'placeholder',
  })
)
if (isVercelBlobEnabled) {
  console.log('Vercel Blob storage enabled')
}

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: ' | Status',
    },
    components: {
      beforeDashboard: ['@/components/admin/DashboardWidgets#DashboardWidgets'],
    },
  },
  collections: [
    // Status collections
    ServiceGroups,
    Services,
    Incidents,
    Maintenances,
    // Notification collections
    Notifications,
    Subscribers,
    // Admin collections
    Users,
    Media,
  ],
  globals: [Settings, EmailSettings, SmsSettings],
  plugins,
  editor: lexicalEditor({
    features: () => [
      ParagraphFeature(),
      BoldFeature(),
      ItalicFeature(),
      UnderlineFeature(),
      StrikethroughFeature(),
      LinkFeature(),
      FixedToolbarFeature(),
    ],
  }),
  secret: process.env.PAYLOAD_SECRET || 'default-secret-change-me',
  typescript: {
    outputFile: path.resolve(dirname, 'src/payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || process.env.POSTGRES_URL || '',
    },
    prodMigrations: migrations,
  }),
  // Jobs Queue configuration
  jobs: {
    tasks: [
      {
        slug: 'sendNotificationFromCollection',
        handler: sendNotificationFromCollectionHandler as any,
        inputSchema: [
          { name: 'notificationId', type: 'text', required: true },
          { name: 'channel', type: 'text', required: true },
          { name: 'subject', type: 'text' },
          { name: 'emailBody', type: 'text' },
          { name: 'smsBody', type: 'text' },
          { name: 'itemTitle', type: 'text', required: true },
          { name: 'itemUrl', type: 'text', required: true },
        ],
        retries: 3,
      },
      {
        slug: 'checkServiceHealth',
        handler: checkServiceHealthHandler as any,
        inputSchema: [
          { name: 'serviceId', type: 'text', required: true }, // Must be text, converted to number in handler
        ],
        retries: 2,
      },
      {
        slug: 'scheduleMonitoringChecks',
        handler: scheduleMonitoringChecksHandler as any,
        inputSchema: [],
        retries: 1,
      },
    ],
  },
  onInit: async (payload) => {
    // Start automatic monitoring scheduler
    const monitoringSchedule = process.env.MONITORING_SCHEDULE || '* * * * *' // Default: every minute
    const enableAutoMonitoring = process.env.ENABLE_AUTO_MONITORING !== 'false' // Default: enabled
    
    if (enableAutoMonitoring) {
      console.log('[Payload] Initializing automatic monitoring scheduler...')
      try {
        await startMonitoringScheduler(monitoringSchedule)
        console.log('[Payload] Automatic monitoring scheduler initialized')
      } catch (error: any) {
        console.error('[Payload] Failed to start monitoring scheduler:', error.message)
      }
    } else {
      console.log('[Payload] Automatic monitoring scheduler disabled (ENABLE_AUTO_MONITORING=false)')
    }
  },
  serverURL: getServerUrl(),
})
