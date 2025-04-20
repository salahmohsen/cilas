CREATE TABLE "authors_table" (
	"author_id" text NOT NULL,
	"post_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"is_main_author" boolean DEFAULT false,
	CONSTRAINT "authors_table_author_id_post_id_pk" PRIMARY KEY("author_id","post_id")
);
--> statement-breakpoint
ALTER TABLE "author_to_role" DROP CONSTRAINT "author_to_role_post_id_blog_posts_id_fk";
--> statement-breakpoint
ALTER TABLE "author_to_role" DROP CONSTRAINT "author_to_role_author_id_post_id_pk";--> statement-breakpoint
ALTER TABLE "author_to_role" ALTER COLUMN "is_main_author" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "author_to_role" ADD CONSTRAINT "author_to_role_author_id_rule_id_pk" PRIMARY KEY("author_id","rule_id");--> statement-breakpoint
ALTER TABLE "authors_table" ADD CONSTRAINT "authors_table_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authors_table" ADD CONSTRAINT "authors_table_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authors_table" ADD CONSTRAINT "authors_table_role_id_blog_posts_rules_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."blog_posts_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_to_role" DROP COLUMN "post_id";