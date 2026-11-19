import { generateId } from './provider/ToastProviderContext';
import type {
  ToastObject,
  ToastManagerAddOptions,
  ToastManagerPromiseOptions,
  ToastManagerUpdateOptions,
} from './useToastManager';

/**
 * Creates a new toast manager.
 */
export function createToastManager<Data extends object = any>(): ToastManager<Data> {
  const listeners = new Set<(data: ToastManagerEvent) => void>();

  function emit(data: ToastManagerEvent) {
    listeners.forEach((listener) => listener(data));
  }

  return {
    // Only `Toast.Provider` calls this member. For the space in its name, see
    // https://x.com/drosenwasser/status/1816947740032872664.
    ' subscribe': function subscribe(listener: (data: ToastManagerEvent) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    add<T extends Data = Data>(options: ToastManagerAddOptions<T>): string {
      const id = options.id || generateId();
      const toastToAdd: ToastObject<T> = {
        ...options,
        id,
        transitionStatus: 'starting',
      };

      emit({
        action: 'add',
        options: toastToAdd,
      });

      return id;
    },

    close(id?: string): void {
      emit({
        action: 'close',
        options: { id },
      });
    },

    update<T extends Data = Data>(
      id: string,
      updates:
        | ToastManagerUpdateOptions<T>
        | ((prevToast: ToastObject<T>) => ToastManagerUpdateOptions<T>),
    ): void {
      emit({
        action: 'update',
        options: { id, updates },
      });
    },

    promise<Value, T extends Data = Data>(
      promiseValue: Promise<Value>,
      options: ToastManagerPromiseOptions<Value, T>,
    ): Promise<Value> {
      const providerPromises: Promise<Value>[] = [];

      emit({
        action: 'promise',
        options: {
          ...options,
          promise: promiseValue,
          setPromise(promise: Promise<Value>) {
            providerPromises.push(promise);
          },
        },
      });

      // Each provider of the manager gives a promise that rejects when the given promise rejects.
      // The returned promise waits for all of them, so no such rejection stays with no handler.
      return Promise.all(providerPromises).then(() => promiseValue);
    },
  };
}

export interface ToastManager<Data extends object = any> {
  ' subscribe': (listener: (data: ToastManagerEvent) => void) => () => void;
  add: <T extends Data = Data>(options: ToastManagerAddOptions<T>) => string;
  close: (id?: string) => void;
  update: <T extends Data = Data>(
    id: string,
    updates:
      ToastManagerUpdateOptions<T> | ((prevToast: ToastObject<T>) => ToastManagerUpdateOptions<T>),
  ) => void;
  promise: <Value, T extends Data = Data>(
    promiseValue: Promise<Value>,
    options: ToastManagerPromiseOptions<Value, T>,
  ) => Promise<Value>;
}

export interface ToastManagerEvent {
  action: 'add' | 'close' | 'update' | 'promise';
  options: any;
}
