import type { Toast } from '@vase-ui/vue/toast';

export interface CustomToastData {
  userId: string;
}

export function isCustomToast(
  toast: Toast.Root.ToastObject,
): toast is Toast.Root.ToastObject<CustomToastData> {
  return toast.data?.userId !== undefined;
}
