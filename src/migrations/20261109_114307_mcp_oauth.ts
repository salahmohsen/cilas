import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_oauth_clients_grant_types" AS ENUM('authorization_code', 'refresh_token');
  CREATE TYPE "public"."enum_oauth_clients_response_types" AS ENUM('code');
  CREATE TYPE "public"."enum_oauth_clients_token_endpoint_auth_method" AS ENUM('none');
  CREATE TYPE "public"."enum_oauth_auth_codes_code_challenge_method" AS ENUM('S256');
  CREATE TYPE "public"."enum_oauth_tokens_token_type" AS ENUM('access', 'refresh');
  CREATE TABLE "oauth_clients_redirect_uris" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"uri" varchar NOT NULL
  );
  
  CREATE TABLE "oauth_clients_grant_types" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_oauth_clients_grant_types",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "oauth_clients_response_types" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_oauth_clients_response_types",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "oauth_clients" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"client_id" varchar NOT NULL,
  	"client_name" varchar,
  	"token_endpoint_auth_method" "enum_oauth_clients_token_endpoint_auth_method" DEFAULT 'none',
  	"software_id" varchar,
  	"software_version" varchar,
  	"is_active" boolean DEFAULT true,
  	"last_used_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "oauth_auth_codes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code_hash" varchar NOT NULL,
  	"client_id" varchar NOT NULL,
  	"user_id" varchar NOT NULL,
  	"redirect_uri" varchar NOT NULL,
  	"scope" varchar,
  	"code_challenge" varchar NOT NULL,
  	"code_challenge_method" "enum_oauth_auth_codes_code_challenge_method" DEFAULT 'S256' NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"consumed_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "oauth_tokens" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"token_type" "enum_oauth_tokens_token_type" NOT NULL,
  	"client_id" varchar NOT NULL,
  	"user_id" varchar NOT NULL,
  	"scope" varchar,
  	"capabilities" jsonb,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"revoked_at" timestamp(3) with time zone,
  	"last_used_at" timestamp(3) with time zone,
  	"parent_token_id" varchar
  );
  
  CREATE TABLE "oauth_csrf_nonces" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"nonce_hash" varchar NOT NULL,
  	"user_id" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"consumed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "oauth_clients_redirect_uris" ADD CONSTRAINT "oauth_clients_redirect_uris_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."oauth_clients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "oauth_clients_grant_types" ADD CONSTRAINT "oauth_clients_grant_types_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."oauth_clients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "oauth_clients_response_types" ADD CONSTRAINT "oauth_clients_response_types_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."oauth_clients"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "oauth_clients_redirect_uris_order_idx" ON "oauth_clients_redirect_uris" USING btree ("_order");
  CREATE INDEX "oauth_clients_redirect_uris_parent_id_idx" ON "oauth_clients_redirect_uris" USING btree ("_parent_id");
  CREATE INDEX "oauth_clients_grant_types_order_idx" ON "oauth_clients_grant_types" USING btree ("order");
  CREATE INDEX "oauth_clients_grant_types_parent_idx" ON "oauth_clients_grant_types" USING btree ("parent_id");
  CREATE INDEX "oauth_clients_response_types_order_idx" ON "oauth_clients_response_types" USING btree ("order");
  CREATE INDEX "oauth_clients_response_types_parent_idx" ON "oauth_clients_response_types" USING btree ("parent_id");
  CREATE UNIQUE INDEX "oauth_clients_client_id_idx" ON "oauth_clients" USING btree ("client_id");
  CREATE INDEX "oauth_clients_updated_at_idx" ON "oauth_clients" USING btree ("updated_at");
  CREATE INDEX "oauth_clients_created_at_idx" ON "oauth_clients" USING btree ("created_at");
  CREATE UNIQUE INDEX "oauth_auth_codes_code_hash_idx" ON "oauth_auth_codes" USING btree ("code_hash");
  CREATE INDEX "oauth_auth_codes_client_id_idx" ON "oauth_auth_codes" USING btree ("client_id");
  CREATE INDEX "oauth_auth_codes_user_id_idx" ON "oauth_auth_codes" USING btree ("user_id");
  CREATE INDEX "oauth_auth_codes_expires_at_idx" ON "oauth_auth_codes" USING btree ("expires_at");
  CREATE UNIQUE INDEX "oauth_tokens_token_hash_idx" ON "oauth_tokens" USING btree ("token_hash");
  CREATE INDEX "oauth_tokens_token_type_idx" ON "oauth_tokens" USING btree ("token_type");
  CREATE INDEX "oauth_tokens_client_id_idx" ON "oauth_tokens" USING btree ("client_id");
  CREATE INDEX "oauth_tokens_user_id_idx" ON "oauth_tokens" USING btree ("user_id");
  CREATE INDEX "oauth_tokens_expires_at_idx" ON "oauth_tokens" USING btree ("expires_at");
  CREATE INDEX "oauth_tokens_revoked_at_idx" ON "oauth_tokens" USING btree ("revoked_at");
  CREATE INDEX "oauth_tokens_parent_token_id_idx" ON "oauth_tokens" USING btree ("parent_token_id");
  CREATE INDEX "oauth_csrf_nonces_nonce_hash_idx" ON "oauth_csrf_nonces" USING btree ("nonce_hash");
  CREATE INDEX "oauth_csrf_nonces_updated_at_idx" ON "oauth_csrf_nonces" USING btree ("updated_at");
  CREATE INDEX "oauth_csrf_nonces_created_at_idx" ON "oauth_csrf_nonces" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "oauth_clients_redirect_uris" CASCADE;
  DROP TABLE "oauth_clients_grant_types" CASCADE;
  DROP TABLE "oauth_clients_response_types" CASCADE;
  DROP TABLE "oauth_clients" CASCADE;
  DROP TABLE "oauth_auth_codes" CASCADE;
  DROP TABLE "oauth_tokens" CASCADE;
  DROP TABLE "oauth_csrf_nonces" CASCADE;
  DROP TYPE "public"."enum_oauth_clients_grant_types";
  DROP TYPE "public"."enum_oauth_clients_response_types";
  DROP TYPE "public"."enum_oauth_clients_token_endpoint_auth_method";
  DROP TYPE "public"."enum_oauth_auth_codes_code_challenge_method";
  DROP TYPE "public"."enum_oauth_tokens_token_type";`)
}
