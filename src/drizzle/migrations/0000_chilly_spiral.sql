CREATE TABLE "course" (
	"id" serial PRIMARY KEY NOT NULL,
	"draft_mode" boolean DEFAULT true,
	"en_title" varchar(255),
	"en_content" json,
	"ar_title" varchar(255),
	"ar_content" json,
	"featured_image" text,
	"fellow_id" text NOT NULL,
	"category" varchar(100) NOT NULL,
	"is_registration_open" boolean DEFAULT false NOT NULL,
	"attendance" varchar(50) NOT NULL,
	"suggestedPrice" json NOT NULL,
	"days" json,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"time_slot" json NOT NULL,
	"max_students" integer,
	"apply_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_enrollment" (
	"course_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"enrollment_date" timestamp with time zone DEFAULT now() NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"paid_amount" integer,
	"payment_date" timestamp with time zone,
	CONSTRAINT "course_enrollment_course_id_user_id_pk" PRIMARY KEY("course_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "posts_authors_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"ar_name" varchar(255),
	"en_name" varchar(255) NOT NULL,
	"description" varchar(255),
	CONSTRAINT "posts_authors_roles_ar_name_unique" UNIQUE("ar_name"),
	CONSTRAINT "posts_authors_roles_en_name_unique" UNIQUE("en_name")
);
--> statement-breakpoint
CREATE TABLE "author_to_role" (
	"author_id" text NOT NULL,
	"rule_id" integer NOT NULL,
	"is_main_author" boolean DEFAULT false NOT NULL,
	CONSTRAINT "author_to_role_author_id_rule_id_pk" PRIMARY KEY("author_id","rule_id")
);
--> statement-breakpoint
CREATE TABLE "authors_table" (
	"author_id" text NOT NULL,
	"post_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"is_main_author" boolean DEFAULT false,
	CONSTRAINT "authors_table_author_id_post_id_pk" PRIMARY KEY("author_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "blogs_to_tags" (
	"blog_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "blogs_to_tags_blog_id_tag_id_pk" PRIMARY KEY("blog_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "post_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"en_name" varchar(100) NOT NULL,
	"ar_name" varchar(100) NOT NULL,
	"slug" varchar(150) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_categories_en_name_unique" UNIQUE("en_name"),
	CONSTRAINT "post_categories_ar_name_unique" UNIQUE("ar_name"),
	CONSTRAINT "post_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "blog_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"en_name" varchar(100) NOT NULL,
	"ar_name" varchar(100) NOT NULL,
	"slug" varchar(150) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_tags_en_name_unique" UNIQUE("en_name"),
	CONSTRAINT "blog_tags_ar_name_unique" UNIQUE("ar_name"),
	CONSTRAINT "blog_tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"is_draft" boolean DEFAULT true NOT NULL,
	"slug" varchar(255) NOT NULL,
	"en_title" varchar(255) NOT NULL,
	"en_content" json NOT NULL,
	"ar_title" varchar(255) NOT NULL,
	"ar_content" json NOT NULL,
	"excerpt" text,
	"featured_image" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "blogs_to_categories" (
	"blog_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	CONSTRAINT "blogs_to_categories_blog_id_category_id_pk" PRIMARY KEY("blog_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"google_id" text,
	"email" varchar(255) NOT NULL,
	"user_name" varchar(50),
	"password_hash" text,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"tel" varchar(20),
	"avatar" text,
	"bio" text,
	"role" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_google_id_unique" UNIQUE("google_id"),
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_user_name_unique" UNIQUE("user_name")
);
--> statement-breakpoint
CREATE TABLE "series" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "series_posts" (
	"series_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "series_posts_series_id_post_id_pk" PRIMARY KEY("series_id","post_id")
);
--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_fellow_id_user_id_fk" FOREIGN KEY ("fellow_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_enrollment" ADD CONSTRAINT "course_enrollment_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_enrollment" ADD CONSTRAINT "course_enrollment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_to_role" ADD CONSTRAINT "author_to_role_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_to_role" ADD CONSTRAINT "author_to_role_rule_id_posts_authors_roles_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."posts_authors_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authors_table" ADD CONSTRAINT "authors_table_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authors_table" ADD CONSTRAINT "authors_table_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authors_table" ADD CONSTRAINT "authors_table_role_id_posts_authors_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."posts_authors_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blogs_to_tags" ADD CONSTRAINT "blogs_to_tags_blog_id_posts_id_fk" FOREIGN KEY ("blog_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blogs_to_tags" ADD CONSTRAINT "blogs_to_tags_tag_id_blog_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."blog_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blogs_to_categories" ADD CONSTRAINT "blogs_to_categories_blog_id_posts_id_fk" FOREIGN KEY ("blog_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blogs_to_categories" ADD CONSTRAINT "blogs_to_categories_category_id_post_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."post_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_posts" ADD CONSTRAINT "series_posts_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_posts" ADD CONSTRAINT "series_posts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;