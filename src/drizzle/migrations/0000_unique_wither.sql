CREATE TABLE "account" (
	"user_id" text NOT NULL,
	"refresh_token_expires_at" timestamp,
	"access_token_expires_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"provider_id" text NOT NULL,
	"account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"id" text PRIMARY KEY NOT NULL,
	"password" text,
	"id_token" text,
	"scope" text
);
--> statement-breakpoint
CREATE TABLE "session" (
	"user_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"id" text PRIMARY KEY NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"email_verified" boolean NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"image" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"expires_at" timestamp NOT NULL,
	"identifier" text NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp,
	"value" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course" (
	"days" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_registration_open" boolean DEFAULT false NOT NULL,
	"suggestedPrice" json NOT NULL,
	"fellow_id" text NOT NULL,
	"attendance" varchar(50) NOT NULL,
	"start_date" date NOT NULL,
	"category" varchar(100) NOT NULL,
	"end_date" date NOT NULL,
	"ar_content" json,
	"en_content" json,
	"draft_mode" boolean DEFAULT true,
	"ar_title" varchar(255),
	"en_title" varchar(255),
	"time_slot" json NOT NULL,
	"featured_image" text,
	"max_students" integer,
	"id" serial PRIMARY KEY NOT NULL,
	"apply_url" text
);
--> statement-breakpoint
CREATE TABLE "course_enrollment" (
	"enrollment_date" timestamp with time zone DEFAULT now() NOT NULL,
	"course_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"payment_date" timestamp with time zone,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"paid_amount" integer,
	CONSTRAINT "course_enrollment_course_id_user_id_pk" PRIMARY KEY("course_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "posts_authors_roles" (
	"en_name" varchar(255) NOT NULL,
	"description" varchar(255),
	"ar_name" varchar(255),
	"id" serial PRIMARY KEY NOT NULL,
	CONSTRAINT "posts_authors_roles_en_name_unique" UNIQUE("en_name"),
	CONSTRAINT "posts_authors_roles_ar_name_unique" UNIQUE("ar_name")
);
--> statement-breakpoint
CREATE TABLE "author_to_role" (
	"role_id" integer NOT NULL,
	"author_id" text NOT NULL,
	"is_main_author" boolean DEFAULT false NOT NULL,
	CONSTRAINT "author_to_role_author_id_role_id_pk" PRIMARY KEY("author_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "authors_table" (
	"role_id" integer NOT NULL,
	"author_id" text NOT NULL,
	"post_id" integer NOT NULL,
	"is_main_author" boolean DEFAULT false,
	CONSTRAINT "authors_table_author_id_post_id_pk" PRIMARY KEY("author_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "post_categories" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ar_name" varchar(100) NOT NULL,
	"en_name" varchar(100) NOT NULL,
	"slug" varchar(150) NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	CONSTRAINT "post_categories_ar_name_unique" UNIQUE("ar_name"),
	CONSTRAINT "post_categories_en_name_unique" UNIQUE("en_name"),
	CONSTRAINT "post_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "series" (
	"name" varchar(255) NOT NULL,
	"description" text,
	"id" serial PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_tags" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ar_name" varchar(100) NOT NULL,
	"en_name" varchar(100) NOT NULL,
	"slug" varchar(150) NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	CONSTRAINT "post_tags_ar_name_unique" UNIQUE("ar_name"),
	CONSTRAINT "post_tags_en_name_unique" UNIQUE("en_name"),
	CONSTRAINT "post_tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "post_to_series" (
	"series_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "post_to_series_series_id_post_id_pk" PRIMARY KEY("series_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"ar_content" json NOT NULL,
	"en_content" json NOT NULL,
	"slug" varchar(255) NOT NULL,
	"ar_title" varchar(255) NOT NULL,
	"en_title" varchar(255) NOT NULL,
	"is_draft" boolean DEFAULT true NOT NULL,
	"featured_image" text,
	"id" serial PRIMARY KEY NOT NULL,
	"excerpt" text,
	CONSTRAINT "posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "post_to_categories" (
	"category_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	CONSTRAINT "post_to_categories_post_id_category_id_pk" PRIMARY KEY("post_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "post_to_tags" (
	"tag_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	CONSTRAINT "post_to_tags_post_id_tag_id_pk" PRIMARY KEY("post_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_fellow_id_user_id_fk" FOREIGN KEY ("fellow_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_enrollment" ADD CONSTRAINT "course_enrollment_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_enrollment" ADD CONSTRAINT "course_enrollment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_to_role" ADD CONSTRAINT "author_to_role_role_id_posts_authors_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."posts_authors_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_to_role" ADD CONSTRAINT "author_to_role_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authors_table" ADD CONSTRAINT "authors_table_role_id_posts_authors_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."posts_authors_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authors_table" ADD CONSTRAINT "authors_table_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authors_table" ADD CONSTRAINT "authors_table_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_to_series" ADD CONSTRAINT "post_to_series_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_to_series" ADD CONSTRAINT "post_to_series_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_to_categories" ADD CONSTRAINT "post_to_categories_category_id_post_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."post_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_to_categories" ADD CONSTRAINT "post_to_categories_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_to_tags" ADD CONSTRAINT "post_to_tags_tag_id_post_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."post_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_to_tags" ADD CONSTRAINT "post_to_tags_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;