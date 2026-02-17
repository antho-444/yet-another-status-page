import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_services_monitoring_method" AS ENUM('GET', 'HEAD', 'POST');
  CREATE TYPE "public"."enum_services_monitoring_last_check_status" AS ENUM('success', 'failed', 'pending');
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'checkServiceHealth';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'scheduleMonitoringChecks';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'checkServiceHealth';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'scheduleMonitoringChecks';
  ALTER TABLE "services" ADD COLUMN "monitoring_enabled" boolean DEFAULT false;
  ALTER TABLE "services" ADD COLUMN "monitoring_url" varchar;
  ALTER TABLE "services" ADD COLUMN "monitoring_method" "enum_services_monitoring_method" DEFAULT 'GET';
  ALTER TABLE "services" ADD COLUMN "monitoring_interval" numeric DEFAULT 60;
  ALTER TABLE "services" ADD COLUMN "monitoring_timeout" numeric DEFAULT 10;
  ALTER TABLE "services" ADD COLUMN "monitoring_expected_status_code" numeric DEFAULT 200;
  ALTER TABLE "services" ADD COLUMN "monitoring_last_checked_at" timestamp(3) with time zone;
  ALTER TABLE "services" ADD COLUMN "monitoring_last_check_status" "enum_services_monitoring_last_check_status";
  ALTER TABLE "services" ADD COLUMN "monitoring_consecutive_failures" numeric DEFAULT 0;
  ALTER TABLE "services" ADD COLUMN "monitoring_failure_threshold" numeric DEFAULT 3;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "services" DROP COLUMN "monitoring_enabled";
  ALTER TABLE "services" DROP COLUMN "monitoring_url";
  ALTER TABLE "services" DROP COLUMN "monitoring_method";
  ALTER TABLE "services" DROP COLUMN "monitoring_interval";
  ALTER TABLE "services" DROP COLUMN "monitoring_timeout";
  ALTER TABLE "services" DROP COLUMN "monitoring_expected_status_code";
  ALTER TABLE "services" DROP COLUMN "monitoring_last_checked_at";
  ALTER TABLE "services" DROP COLUMN "monitoring_last_check_status";
  ALTER TABLE "services" DROP COLUMN "monitoring_consecutive_failures";
  ALTER TABLE "services" DROP COLUMN "monitoring_failure_threshold";
  DROP TYPE "public"."enum_services_monitoring_method";
  DROP TYPE "public"."enum_services_monitoring_last_check_status";`)
}
