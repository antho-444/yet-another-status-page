import * as migration_20260112_063824 from './20260112_063824';
import * as migration_20260112_163613_split_email_sms_settings from './20260112_163613_split_email_sms_settings';
import * as migration_20260216_171400_add_service_monitoring from './20260216_171400_add_service_monitoring';
import * as migration_20260216_184200_add_monitoring_types from './20260216_184200_add_monitoring_types';
import * as migration_20260216_211700_add_settings_monitoring_schedule from './20260216_211700_add_settings_monitoring_schedule';

export const migrations = [
  {
    up: migration_20260112_063824.up,
    down: migration_20260112_063824.down,
    name: '20260112_063824',
  },
  {
    up: migration_20260112_163613_split_email_sms_settings.up,
    down: migration_20260112_163613_split_email_sms_settings.down,
    name: '20260112_163613_split_email_sms_settings'
  },
  {
    up: migration_20260216_171400_add_service_monitoring.up,
    down: migration_20260216_171400_add_service_monitoring.down,
    name: '20260216_171400_add_service_monitoring'
  },
  {
    up: migration_20260216_184200_add_monitoring_types.up,
    down: migration_20260216_184200_add_monitoring_types.down,
    name: '20260216_184200_add_monitoring_types'
  },
  {
    up: migration_20260216_211700_add_settings_monitoring_schedule.up,
    down: migration_20260216_211700_add_settings_monitoring_schedule.down,
    name: '20260216_211700_add_settings_monitoring_schedule'
  },
];
