import { BasicInput, ComboBoxInput, DateInput, Textarea } from "@/components/form-inputs";
import { ComboBoxOption } from "@/lib/types/form.inputs.types";
import { getUsersNames } from "@/lib/users/users.actions";
import { useCallback, useEffect, useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { PostSchema } from "../_lib/posts.schema";

type PostMetaProps = { formMethods: UseFormReturn<PostSchema> };

export default function PostMeta({ formMethods }: PostMetaProps) {
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

  return (
    <div className="space-y-5 p-5">
      <BasicInput<PostSchema, "slug">
        label="Slug"
        name="slug"
        type="text"
        className="block"
        placeholder="Type post slug here..."
      />
      <Textarea<PostSchema, "excerpt"> name="excerpt" label="Excerpt" />
      <BasicInput<PostSchema, "featuredImage">
        label="Featured Image"
        name="featuredImage"
        type="file"
        className="block"
        placeholder="Upload featured image..."
      />
      <DateInput<PostSchema, "publishedAt">
        label="Published At"
        name="publishedAt"
        placeholder="Select publish date..."
      />
      <ComboBoxInput<PostSchema, "mainAuthorId">
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
      <ComboBoxInput<PostSchema, "coAuthors">
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
