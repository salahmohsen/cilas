import { type } from "arktype";

const parseJson = (schema: type) => {
  const parseJson = type("string.json.parse").to(schema);

  return parseJson;
};
