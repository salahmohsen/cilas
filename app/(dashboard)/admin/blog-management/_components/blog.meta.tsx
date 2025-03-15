import { BasicInput, DateInput, Textarea } from "@/components/form-inputs";
import { BlogSchema } from "@/lib/types/form.schema";

type BlogMetaProps = {};

export default function BlogMeta({}: BlogMetaProps) {
  return (
    <div className="space-y-5 p-5">
      <BasicInput<BlogSchema, "slug">
        label="Slug"
        name="slug"
        type="text"
        className="block"
        placeholder="Type blog slug here..."
      />
      <Textarea<BlogSchema, "excerpt"> name="excerpt" label="Excerpt" />
      <BasicInput<BlogSchema, "featuredImage">
        label="Featured Image"
        name="featuredImage"
        type="file"
        className="block"
        placeholder="Upload featured image..."
      />
      <DateInput<BlogSchema, "publishedAt">
        label="Published At"
        name="publishedAt"
        placeholder="Select publish date..."
      />
    </div>
  );
}
