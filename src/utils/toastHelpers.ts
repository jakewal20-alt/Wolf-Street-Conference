import { toast } from "sonner";

export const toastSuccess = (message: string, description?: string) => {
  return toast.success(message, {
    description,
    className: "group",
  });
};

export const toastError = (message: string, description?: string) => {
  return toast.error(message, {
    description,
    className: "group",
  });
};

export const toastWarning = (message: string, description?: string) => {
  return toast.warning(message, {
    description,
    className: "group",
  });
};

export const toastInfo = (message: string, description?: string) => {
  return toast.info(message, {
    description,
    className: "group",
  });
};

export const toastPromise = <T,>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string;
    error: string;
  }
) => {
  return toast.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: messages.error,
  });
};
