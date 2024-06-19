import sanitizeHtml from "sanitize-html";

export const cleanHtml = (dirty: string): string => {
  const options = {
    allowedTags: [
      "p",
      "h3",
      "hr",
      "li",
      "ol",
      "ul",
      "em",
      "i",
      "strong",
      "b",
      "blockquote",
      "s",
      "a",
      "br",
    ],
    // Transform 'a' tags to add target and rel attributes
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer",
      }),
    },
    // Define allowed attributes
    allowedAttributes: {
      a: ["href", "target", "rel"],
      p: ["dir"],
      h4: ["dir"],
    },
  };

  return sanitizeHtml(dirty, options);
};
