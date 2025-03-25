import { serverActionStateBase } from "../types/server.actions";

export const newPost = (
  prevState: serverActionStateBase,
  formData: FormData,
): Promise<serverActionStateBase> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: "Post created successfully",
      });
    }, 2000);
  });
};
