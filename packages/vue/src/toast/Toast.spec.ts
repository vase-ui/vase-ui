import { expectType } from '#test-utils';
import type { ComputedRef } from 'vue';
import {
  Toast,
  type ToastLabel,
  type ToastManager,
  type ToastObject,
  type UseToastManagerReturnValue,
} from '@vase-ui/vue/toast';

// `Data` goes from the manager to each method and to the toasts.
interface Data {
  file: string;
}
const manager = Toast.createToastManager<Data>();
expectType<ToastManager<Data>, typeof manager>(manager);
manager.add({ data: { file: 'a.txt' } });
manager.update('id', (toast) => ({ data: { file: `${toast.data?.file ?? ''}!` } }));
// @ts-expect-error `size` is not a key of the data.
manager.add({ data: { size: 1 } });

// The data of an update replaces the whole value, so it has each key of the type.
interface Payload {
  id: string;
  count: number;
}
const typed = Toast.createToastManager<Payload>();
// @ts-expect-error The data has no `count`.
typed.add({ data: { id: 'a' } });
// @ts-expect-error The data has no `count`.
typed.update('a', { data: { id: 'a' } });
typed.update('a', (toast) => {
  expectType<Payload | undefined, typeof toast.data>(toast.data);
  return { data: { id: 'a', count: 2 } };
});
// @ts-expect-error The function returns data with no `count`.
typed.update('a', () => ({ data: { id: 'a' } }));

// Only the loading state takes an `id`, and each state takes the data.
void typed.promise(Promise.resolve(2), {
  loading: { id: 'a', data: { id: 'a', count: 0 } },
  success: (value) => ({ data: { id: 'a', count: value } }),
  error: 'Failed',
});
void typed.promise(Promise.resolve(2), {
  loading: 'Loading',
  // @ts-expect-error `id` is only for the loading state.
  success: { id: 'a', title: 'Done' },
  // @ts-expect-error `id` is only for the loading state.
  error: { id: 'a', title: 'Failed' },
});

// A manager with no type takes the type of the data at each call.
const untyped = Toast.createToastManager();
expectType<string, ReturnType<typeof untyped.add>>(
  untyped.add<Payload>({ data: { id: 'a', count: 3 } }),
);
// @ts-expect-error The data has no `count`.
untyped.update<Payload>('a', { data: { id: 'a' } });
void untyped.promise<number, Payload>(Promise.resolve(5), {
  loading: { id: 'a' },
  success: (value) => ({ data: { id: 'a', count: value } }),
  error: 'Failed',
});

// A function is data, and a function of `update` gets it.
type Callable = () => string;
const callable = Toast.createToastManager<Callable>();
callable.add({ data: () => 'first' });
callable.update('a', (toast) => {
  expectType<Callable | undefined, typeof toast.data>(toast.data);
  return { data: toast.data };
});

declare const result: UseToastManagerReturnValue<Data>;
expectType<ComputedRef<ToastObject<Data>[]>, typeof result.toasts>(result.toasts);
const promised = result.promise(Promise.resolve(1), {
  loading: 'Loading',
  success: (value) => `Done ${value}`,
  error: 'Failed',
});
expectType<Promise<number>, typeof promised>(promised);

// A label is a text, a number or a function that gives the content; a vnode is none.
export const labels: ToastLabel[] = ['Text', 0, () => 'Content'];
// @ts-expect-error A Boolean is no label.
export const wrongLabel: ToastLabel = true;

// The types of each part are on the part.
export const rootProps: Toast.Root.Props = { toast: { id: 'a' }, swipeDirection: ['up', 'left'] };
// @ts-expect-error `inward` is no direction.
export const wrongDirection: Toast.Root.Props = { toast: { id: 'a' }, swipeDirection: 'inward' };
export const rootState: Toast.Root.State = {
  expanded: false,
  limited: false,
  type: undefined,
  swiping: false,
  swipeDirection: 'down',
};
export const positionerProps: Toast.Positioner.Props = {
  toast: { id: 'a' },
  side: 'inline-end',
  sideOffset: ({ anchor }) => anchor.height,
};
export const actionProps: ToastObject['actionProps'] = { children: () => 'Undo', onClick() {} };

// A template ref of a part has its element.
const root = null as unknown as InstanceType<typeof Toast.Root>;
expectType<HTMLElement | null, typeof root.element>(root.element);
