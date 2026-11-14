import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, Fragment, provide } from 'vue';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  screen,
  takeReportedMessages,
} from '#test-utils';
import * as Toast from './index.parts';
import { ToastContext } from './provider/ToastProviderContext';
import { ToastStore } from './store';
import { useToastManager } from './useToastManager';
import type { UseToastManagerReturnValue } from './useToastManager';

function createStore() {
  return new ToastStore({
    toasts: [],
    timeout: 0,
    limit: 3,
    hovering: false,
    focused: false,
    isWindowFocused: true,
    viewport: null,
    prevFocusElement: null,
  });
}

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('add', () => {
    const { render } = createRenderer();

    it('does not call onRemove when replacing an ending toast', async () => {
      const onRemoveSpy = vi.fn();

      const Buttons = defineComponent({
        setup() {
          const { add, close, toasts } = useToastManager();
          let toastId: string | null = null;

          return () => (
            <Fragment>
              <button
                onClick={() => {
                  toastId = add({
                    id: 'save',
                    title: 'Saving…',
                    timeout: 0,
                    onRemove: onRemoveSpy,
                  });
                }}
              >
                add
              </button>
              <button
                onClick={() => {
                  if (toastId) {
                    close(toastId);
                  }
                }}
              >
                close
              </button>
              <button
                onClick={() => {
                  toastId = add({
                    id: 'save',
                    title: 'Saved',
                    timeout: 0,
                  });
                }}
              >
                re-add
              </button>
              <div data-testid="toast-count">{toasts.value.length}</div>
            </Fragment>
          );
        },
      });

      await render(
        <Toast.Provider>
          <Buttons />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.getByTestId('toast-count')).toHaveTextContent('1');

      await fireEvent.click(screen.getByRole('button', { name: 'close' }));
      await fireEvent.click(screen.getByRole('button', { name: 're-add' }));

      expect(screen.getByTestId('toast-count')).toHaveTextContent('1');
      expect(onRemoveSpy).toHaveBeenCalledTimes(0);
    });

    it('ignores transitionStatus when upserting an existing toast', async () => {
      const Buttons = defineComponent({
        setup() {
          const { add, toasts } = useToastManager();

          return () => (
            <Fragment>
              <button
                onClick={() => {
                  add({
                    id: 'save',
                    title: 'Saving…',
                    timeout: 0,
                  });
                }}
              >
                add
              </button>
              <button
                onClick={() => {
                  add({
                    id: 'save',
                    title: 'Saved',
                    timeout: 0,
                    transitionStatus: 'ending',
                  });
                }}
              >
                upsert
              </button>
              {toasts.value.map((toast) => (
                <Fragment key={toast.id}>
                  <div data-testid="title-value">{toast.title}</div>
                  <div data-testid="transition-status">{toast.transitionStatus}</div>
                </Fragment>
              ))}
            </Fragment>
          );
        },
      });

      await render(
        <Toast.Provider>
          <Buttons />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.getByTestId('title-value')).toHaveTextContent('Saving…');
      expect(screen.getByTestId('transition-status')).toHaveTextContent('starting');

      await fireEvent.click(screen.getByRole('button', { name: 'upsert' }));
      expect(screen.getByTestId('title-value')).toHaveTextContent('Saved');
      expect(screen.getByTestId('transition-status')).toHaveTextContent('starting');
    });

    it('increments updateKey when adding again with the same id', async () => {
      const Buttons = defineComponent({
        setup() {
          const { add, toasts } = useToastManager();

          return () => (
            <Fragment>
              <button
                onClick={() => {
                  add({
                    id: 'save',
                    title: 'Draft saved',
                    timeout: 0,
                  });
                }}
              >
                add
              </button>
              {toasts.value.map((toast) => (
                <div key={toast.id} data-testid="update-key">
                  {toast.updateKey}
                </div>
              ))}
            </Fragment>
          );
        },
      });

      await render(
        <Toast.Provider>
          <Buttons />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.getByTestId('update-key')).toHaveTextContent('0');

      await fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.getByTestId('update-key')).toHaveTextContent('1');
    });
  });

  describe('update', () => {
    const { render } = createRenderer();

    it('increments updateKey when updating a toast', async () => {
      const Buttons = defineComponent({
        setup() {
          const { add, update, toasts } = useToastManager();
          let toastId: string | null = null;

          return () => (
            <Fragment>
              <button
                type="button"
                onClick={() => {
                  toastId = add({
                    id: 'save',
                    title: 'Draft saved',
                    timeout: 0,
                  });
                }}
              >
                add
              </button>
              <button
                type="button"
                onClick={() => {
                  if (toastId) {
                    update(toastId, { title: 'Draft synced' });
                  }
                }}
              >
                update
              </button>
              {toasts.value.map((toast) => (
                <div key={toast.id} data-testid="update-key">
                  {toast.updateKey}
                </div>
              ))}
            </Fragment>
          );
        },
      });

      await render(
        <Toast.Provider>
          <Buttons />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.getByTestId('update-key')).toHaveTextContent('0');

      await fireEvent.click(screen.getByRole('button', { name: 'update' }));
      expect(screen.getByTestId('update-key')).toHaveTextContent('1');
    });
  });
});

describe('useToastManager', () => {
  const { render } = createRenderer();

  const ToastTitles = defineComponent({
    props: { onManager: { type: Function, required: true } },
    setup(props) {
      const manager = useToastManager();
      props.onManager(manager);
      return () => (
        <ul>
          {manager.toasts.value.map((toast) => (
            <li key={toast.id}>{toast.title}</li>
          ))}
        </ul>
      );
    },
  });

  function createScope(store: ToastStore) {
    return defineComponent({
      setup(_, { slots }) {
        provide(ToastContext, store);
        return () => slots.default?.();
      },
    });
  }

  it('gives the toasts of the store as a ref that a render follows', async () => {
    const store = createStore();
    const Scope = createScope(store);
    let manager: UseToastManagerReturnValue | undefined;

    await render(
      <Scope>
        <ToastTitles
          onManager={(value: UseToastManagerReturnValue) => {
            manager = value;
          }}
        />
      </Scope>,
    );

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);

    const id = manager!.add({ title: 'First' });
    store.addToast({ title: 'Second' });
    await flushMicrotasks();

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Second',
      'First',
    ]);

    manager!.update(id, { title: 'First, updated' });
    await flushMicrotasks();

    expect(screen.getAllByRole('listitem')[1].textContent).toBe('First, updated');

    manager!.close();
    await flushMicrotasks();

    expect(manager!.toasts.value.map((toast) => toast.transitionStatus)).toEqual([
      'ending',
      'ending',
    ]);
  });

  it('gives the methods of the store of the nearest provider', async () => {
    const outerStore = createStore();
    const innerStore = createStore();
    const Outer = createScope(outerStore);
    const Inner = createScope(innerStore);
    let manager: UseToastManagerReturnValue | undefined;

    await render(
      <Outer>
        <Inner>
          <ToastTitles
            onManager={(value: UseToastManagerReturnValue) => {
              manager = value;
            }}
          />
        </Inner>
      </Outer>,
    );

    manager!.add({ title: 'Inner' });

    expect(innerStore.state.toasts).toHaveLength(1);
    expect(outerStore.state.toasts).toHaveLength(0);
  });

  // A case that throws in `setup` is the last case of its file.
  it('throws an error that names the provider when no provider is above it', async () => {
    await expect(render(<ToastTitles onManager={() => {}} />)).rejects.toThrow(
      'Vase UI: No <Toast.Provider> is above this component. `useToastManager` and each part of Toast read the toasts of the provider. Put the component inside <Toast.Provider>.',
    );

    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
