import { Document as TiptapDocument } from "@tiptap/extension-document";

export const Document = TiptapDocument.extend({
  content: "heading (block|columns)+",
});

export default Document;
