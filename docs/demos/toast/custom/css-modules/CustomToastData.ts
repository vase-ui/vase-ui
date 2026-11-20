import type { ToastObject } from '@vase-ui/vue/toast';

export interface CustomToastData {
  userId: string;
}

export function isCustomToast(toast: ToastObject): toast is ToastObject<CustomToastData> {
  return toast.data?.userId !== undefined;
}
