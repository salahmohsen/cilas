CREATE TABLE IF NOT EXISTS "course_category" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "course" (
	"id" serial PRIMARY KEY NOT NULL,
	"en_title" text NOT NULL,
	"ar_title" text,
	"image_url" text,
	"author_id" integer NOT NULL,
	"en_content" text,
	"ar_content" text,
	"season_cycle" text,
	"category" text NOT NULL,
	"attendance" text NOT NULL,
	"registration_status" boolean NOT NULL,
	"price" integer,
	"start_date" date NOT NULL,
	"end_Date" date NOT NULL,
	"week_duration" integer,
	"days" json,
	"session_start_at" time NOT NULL,
	"session_end_at" time NOT NULL,
	"course_flow_url" text,
	"apply_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "draft-course" (
	"id" serial PRIMARY KEY NOT NULL,
	"en_title" text,
	"ar_title" text,
	"image_url" text,
	"author_id" integer,
	"en_content" text,
	"ar_content" text,
	"season_cycle" text,
	"category" text,
	"attendance" text,
	"registration_status" boolean,
	"price" integer,
	"start_date" date,
	"end_Date" date,
	"week_duration" integer,
	"days" json,
	"session_start_at" time,
	"session_end_at" time,
	"course_flow_url" text,
	"apply_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"bio" text,
	"email" text,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "course" ADD CONSTRAINT "course_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "draft-course" ADD CONSTRAINT "draft-course_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
