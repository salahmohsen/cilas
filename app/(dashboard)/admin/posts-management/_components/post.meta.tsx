import { BasicInput, ComboBoxInput, DateInput, Textarea } from "@/components/form-inputs";
import { ComboBoxOption } from "@/lib/types/form.inputs.types";
import { getUsersNames } from "@/lib/users/users.actions";
import { useCallback, useEffect, useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { BlogSchema } from "../_lib/posts.schema";

type BlogMetaProps = { formMethods: UseFormReturn<BlogSchema> };

export default function BlogMeta({ formMethods }: BlogMetaProps) {
  const [authors, setAuthors] = useState<ComboBoxOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [coAuthors, setCoAuthors] = useState<string[] | undefined>([]);

  const getAuthors = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getUsersNames(undefined, true);
      setAuthors(data as ComboBoxOption[]);
      setIsLoading(false);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const coAuthor = formMethods.getValues("coAuthors");
  useEffect(() => {
    setCoAuthors((prev) => (prev && coAuthor ? [...prev, ...coAuthor] : coAuthor));
  }, [coAuthor]);

  console.log("coAuthors", coAuthors);

  return (
    <div className="space-y-5 p-5">
      <BasicInput<BlogSchema, "slug">
        label="Slug"
        name="slug"
        type="text"
        className="block"
        placeholder="Type post slug here..."
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
      <ComboBoxInput<BlogSchema, "mainAuthorId">
        name="mainAuthorId"
        label="Main author"
        placeholder="Select main author..."
        emptyMsg="User Not Found"
        searchPlaceholder="Search users..."
        action={getAuthors}
        options={authors}
        // defaultOption={}
        loading={isLoading}
      />
      <ComboBoxInput<BlogSchema, "coAuthors">
        name="coAuthors"
        label="Co-Authors"
        placeholder="Select co-author author..."
        emptyMsg="User Not Found"
        searchPlaceholder="Search users..."
        action={getAuthors}
        options={authors}
        // defaultOption={}
        loading={isLoading}
      />
    </div>
  );
}
