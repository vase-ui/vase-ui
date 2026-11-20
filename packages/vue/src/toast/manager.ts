import type {
  ToastManager,
  ToastManagerAddOptions,
  ToastManagerEvent,
  ToastManagerPromiseOptions,
} from './types';

// One count for each manager and each provider, so that each generated id of a page is new. The
// prefix keeps the ids apart from the ids of the developer, such as `toast-1`. No part renders a
// toast id, so the server HTML does not depend on the count.
let count = 0;

export function nextToastId() {
  count += 1;
  return `vase-ui-toast-${count}`;
}

/** Makes a manager that adds and changes the toasts of each provider that has it. */
export function createToastManager<Data extends object = any>(): ToastManager<Data> {
  const listeners = new Set<(event: ToastManagerEvent) => void>();

  function emit(event: ToastManagerEvent) {
    for (const listener of listeners) listener(event);
  }

  return {
    ' subscribe'(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    add(options: ToastManagerAddOptions) {
      const id = options.id || nextToastId();
      emit({ action: 'add', options: { ...options, id } });
      return id;
    },
    close(id) {
      emit({ action: 'close', options: { id } });
    },
    update(id, updates) {
      emit({ action: 'update', options: { id, updates } });
    },
    promise<Value, T extends Data = Data>(
      promise: Promise<Value>,
      options: ToastManagerPromiseOptions<Value, T>,
    ): Promise<Value> {
      const handled: Promise<Value>[] = [];
      emit({
        action: 'promise',
        options: {
          ...options,
          promise,
          setPromise: (each: Promise<Value>) => handled.push(each),
        },
      });
      // Each provider gives a promise that rejects when the promise rejects. The result waits for
      // them, so no such rejection stays with no handler, and the caller gets the value or the reason.
      return Promise.all(handled).then(() => promise);
    },
  };
}
