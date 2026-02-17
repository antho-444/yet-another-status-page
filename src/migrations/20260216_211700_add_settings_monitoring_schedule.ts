import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_settings_monitoring_schedule_type" AS ENUM('minutes', 'hours', 'days', 'weeks');
  ALTER TABLE "settings" ADD COLUMN "monitoring_enabled" boolean DEFAULT true;
  ALTER TABLE "settings" ADD COLUMN "monitoring_schedule_type" "enum_settings_monitoring_schedule_type" DEFAULT 'minutes';
  ALTER TABLE "settings" ADD COLUMN "monitoring_schedule_interval" numeric DEFAULT 1;
  ALTER TABLE "settings" ADD COLUMN "monitoring_schedule_cron" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "settings" DROP COLUMN "monitoring_enabled";
  ALTER TABLE "settings" DROP COLUMN "monitoring_schedule_type";
  ALTER TABLE "settings" DROP COLUMN "monitoring_schedule_interval";
  ALTER TABLE "settings" DROP COLUMN "monitoring_schedule_cron";
  DROP TYPE "public"."enum_settings_monitoring_schedule_type";`)
}
