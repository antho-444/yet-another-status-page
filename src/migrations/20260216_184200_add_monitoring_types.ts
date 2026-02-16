import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_services_monitoring_type" AS ENUM('http', 'tcp', 'ping', 'gamedig');
  CREATE TYPE "public"."enum_services_monitoring_game_type" AS ENUM('minecraft', 'cs', 'tf2', 'garrysmod', 'arkse', 'rust', '7d2d', 'valheim');
  ALTER TABLE "services" ADD COLUMN "monitoring_type" "enum_services_monitoring_type" DEFAULT 'http';
  ALTER TABLE "services" ADD COLUMN "monitoring_host" varchar;
  ALTER TABLE "services" ADD COLUMN "monitoring_port" numeric;
  ALTER TABLE "services" ADD COLUMN "monitoring_game_type" "enum_services_monitoring_game_type";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "services" DROP COLUMN "monitoring_type";
  ALTER TABLE "services" DROP COLUMN "monitoring_host";
  ALTER TABLE "services" DROP COLUMN "monitoring_port";
  ALTER TABLE "services" DROP COLUMN "monitoring_game_type";
  DROP TYPE "public"."enum_services_monitoring_type";
  DROP TYPE "public"."enum_services_monitoring_game_type";`)
}
