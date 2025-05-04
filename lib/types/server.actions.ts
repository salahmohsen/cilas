export interface ServerActionReturn {
  success?: boolean;
  error?: boolean;
  message: string;
  data?: unknown;
}

export const InitialState: ServerActionReturn = {
  success: false,
  error: false,
  message: "",
  data: null,
};
