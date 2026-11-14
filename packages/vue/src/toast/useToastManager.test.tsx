import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { defineComponent, Fragment, provide, shallowRef } from 'vue';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  screen,
  takeReportedMessages,
  waitForLaterMillisecond,
} from '#test-utils';
import { Dialog } from '@vase-ui/vue/dialog';
import { Toast } from '@vase-ui/vue/toast';
import { ToastContext } from './provider/ToastProviderContext';
import { ToastStore } from './store';
import { useToastManager } from './useToastManager';
import type { UseToastManagerReturnValue } from './useToastManager';
import { List } from './utils/test-utils';

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

async function tick(ms: number) {
  vi.advanceTimersByTime(ms);
  await flushMicrotasks();
}

// A promise that resolves at once changes the toast before an awaited event resolves. The case thus
// records each text that an element shows, in the order of the DOM updates.
function recordTextContent<TestId extends string>(...testIds: TestId[]) {
  const texts = Object.fromEntries(testIds.map((testId) => [testId, [] as string[]])) as Record<
    TestId,
    string[]
  >;
  const observer = new MutationObserver(() => {
    for (const testId of testIds) {
      const text = screen.queryByTestId(testId)?.textContent;
      if (text != null && texts[testId].at(-1) !== text) {
        texts[testId].push(text);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  onTestFinished(() => observer.disconnect());
  return texts;
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

    it('adds a toast to the viewport that auto-dismisses after 5s by default', async () => {
      const AddButton = defineComponent({
        setup() {
          const { add } = useToastManager();
          return () => (
            <button
              onClick={() => {
                add({
                  title: 'test',
                });
              }}
            >
              add
            </button>
          );
        },
      });

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      await fireEvent.click(button);

      expect(screen.queryByTestId('root')).not.toBe(null);

      await tick(5000);

      expect(screen.queryByTestId('root')).toBe(null);
    });

    it('keeps multiple providers isolated when one provider updates', async () => {
      const ProviderContents = defineComponent({
        props: {
          label: { type: String, required: true },
          title: { type: String, required: true },
        },
        setup(props) {
          const { add, update, toasts } = useToastManager();
          let id: string | null = null;

          return () => (
            <>
              <Toast.Viewport>
                {toasts.value.map((toast) => (
                  <Toast.Root key={toast.id} toast={toast}>
                    <Toast.Title />
                  </Toast.Root>
                ))}
              </Toast.Viewport>
              <button
                onClick={() => {
                  id = add({
                    title: props.title,
                  });
                }}
              >
                add {props.label}
              </button>
              <button
                onClick={() => {
                  if (id) {
                    update(id, {
                      title: `${props.title} updated`,
                    });
                  }
                }}
              >
                update {props.label}
              </button>
            </>
          );
        },
      });

      await render(
        <>
          <Toast.Provider>
            <ProviderContents label="first" title="First toast" />
          </Toast.Provider>
          <Toast.Provider>
            <ProviderContents label="second" title="Second toast" />
          </Toast.Provider>
        </>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add first' }));
      await fireEvent.click(screen.getByRole('button', { name: 'add second' }));

      expect(screen.getByText('First toast')).not.toBe(null);
      expect(screen.getByText('Second toast')).not.toBe(null);

      await fireEvent.click(screen.getByRole('button', { name: 'update first' }));

      expect(screen.getByText('First toast updated')).not.toBe(null);
      expect(screen.queryByText('Second toast updated')).toBe(null);
      expect(screen.getByText('Second toast')).not.toBe(null);
    });

    it('replaces a closing toast when adding again with the same id', async () => {
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
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.getByTestId('title')).toHaveTextContent('Saving…');
      expect(screen.queryAllByTestId('root')).toHaveLength(1);

      await fireEvent.click(screen.getByRole('button', { name: 'close' }));
      await fireEvent.click(screen.getByRole('button', { name: 're-add' }));

      expect(screen.getByTestId('title')).toHaveTextContent('Saved');
      expect(screen.queryAllByTestId('root')).toHaveLength(1);
      expect(screen.getByTestId('toast-count')).toHaveTextContent('1');
    });

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

    it('calls onRemove once after replacing an ending toast and later removing the replacement', async () => {
      const onRemoveSpy = vi.fn();

      const Buttons = defineComponent({
        setup() {
          const { add, close, toasts } = useToastManager();
          let toastId: string | null = null;
          const showViewport = shallowRef(false);

          return () => (
            <Fragment>
              {showViewport.value ? (
                <Toast.Viewport>
                  <List />
                </Toast.Viewport>
              ) : null}
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
                    onRemove: onRemoveSpy,
                  });
                }}
              >
                re-add
              </button>
              <button onClick={() => (showViewport.value = true)}>show viewport</button>
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
      await fireEvent.click(screen.getByRole('button', { name: 'close' }));
      await fireEvent.click(screen.getByRole('button', { name: 're-add' }));

      expect(screen.getByTestId('toast-count')).toHaveTextContent('1');
      expect(onRemoveSpy).toHaveBeenCalledTimes(0);

      await fireEvent.click(screen.getByRole('button', { name: 'show viewport' }));
      await fireEvent.click(screen.getByRole('button', { name: 'close' }));

      expect(onRemoveSpy).toHaveBeenCalledTimes(1);
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

    describe('option: timeout', () => {
      it('dismisses the toast after the specified timeout', async () => {
        const AddButton = defineComponent({
          setup() {
            const { add } = useToastManager();
            return () => <button onClick={() => add({ title: 'test', timeout: 1000 })}>add</button>;
          },
        });

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <List />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const button = screen.getByRole('button', { name: 'add' });
        await fireEvent.click(button);

        expect(screen.queryByTestId('root')).not.toBe(null);

        await tick(1000);

        expect(screen.queryByTestId('root')).toBe(null);
      });
    });

    describe('option: title', () => {
      it('renders the title', async () => {
        const AddButton = defineComponent({
          setup() {
            const { add } = useToastManager();
            return () => (
              <button
                onClick={() =>
                  add({
                    title: 'title',
                    description: 'description',
                  })
                }
              >
                add
              </button>
            );
          },
        });

        const CustomList = defineComponent({
          setup() {
            const { toasts } = useToastManager();
            return () =>
              toasts.value.map((t) => (
                <Toast.Root key={t.id} toast={t} data-testid="root">
                  <Toast.Title data-testid="title" />
                </Toast.Root>
              ));
          },
        });

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <CustomList />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const button = screen.getByRole('button', { name: 'add' });
        await fireEvent.click(button);

        expect(screen.queryByTestId('title')).toHaveTextContent('title');
      });
    });

    describe('option: description', () => {
      it('renders the description', async () => {
        const AddButton = defineComponent({
          setup() {
            const { add } = useToastManager();
            return () => (
              <button
                onClick={() =>
                  add({
                    title: 'title',
                    description: 'description',
                  })
                }
              >
                add
              </button>
            );
          },
        });

        const CustomList = defineComponent({
          setup() {
            const { toasts } = useToastManager();
            return () =>
              toasts.value.map((t) => (
                <Toast.Root key={t.id} toast={t} data-testid="root">
                  <Toast.Description data-testid="description" />
                </Toast.Root>
              ));
          },
        });

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <CustomList />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const button = screen.getByRole('button', { name: 'add' });
        await fireEvent.click(button);

        expect(screen.queryByTestId('description')).toHaveTextContent('description');
      });
    });

    describe('option: type', () => {
      it('renders the type', async () => {
        const AddButton = defineComponent({
          setup() {
            const { add } = useToastManager();
            return () => (
              <button onClick={() => add({ title: 'test', type: 'success' })}>add</button>
            );
          },
        });

        const CustomList = defineComponent({
          setup() {
            const { toasts } = useToastManager();
            return () =>
              toasts.value.map((t) => (
                <Toast.Root key={t.id} toast={t} data-testid="root">
                  <Toast.Title data-testid="title" />
                  <span>{t.type}</span>
                </Toast.Root>
              ));
          },
        });

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <CustomList />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const button = screen.getByRole('button', { name: 'add' });
        await fireEvent.click(button);

        expect(screen.queryByTestId('title')).toHaveTextContent('test');
        expect(screen.queryByText('success')).not.toBe(null);
      });
    });

    describe('option: onClose', () => {
      it('calls onClose when the toast is closed', async () => {
        const onCloseSpy = vi.fn();

        const AddButton = defineComponent({
          setup() {
            const { add, close } = useToastManager();
            let id: string | null = null;
            return () => (
              <Fragment>
                <button
                  onClick={() => {
                    id = add({
                      title: 'test',
                      onClose: onCloseSpy,
                    });
                  }}
                >
                  add
                </button>
                <button
                  onClick={() => {
                    if (id) {
                      close(id);
                    }
                  }}
                >
                  close
                </button>
              </Fragment>
            );
          },
        });

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <List />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const addButton = screen.getByRole('button', { name: 'add' });
        await fireEvent.click(addButton);

        expect(onCloseSpy.mock.calls.length).toBe(0);

        const closeButton = screen.getByRole('button', { name: 'close' });
        await fireEvent.click(closeButton);

        expect(onCloseSpy.mock.calls.length).toBe(1);
      });

      it('calls onClose when the toast auto-dismisses', async () => {
        const onCloseSpy = vi.fn();

        const AddButton = defineComponent({
          setup() {
            const { add } = useToastManager();
            return () => (
              <button
                onClick={() => {
                  add({
                    title: 'test',
                    timeout: 1000,
                    onClose: onCloseSpy,
                  });
                }}
              >
                add
              </button>
            );
          },
        });

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <List />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const button = screen.getByRole('button', { name: 'add' });
        await fireEvent.click(button);

        expect(onCloseSpy.mock.calls.length).toBe(0);

        await tick(1000);

        expect(onCloseSpy.mock.calls.length).toBe(1);
      });
    });

    describe('option: onRemove', () => {
      it('calls onRemove when the toast is removed', async () => {
        const onRemoveSpy = vi.fn();

        const AddButton = defineComponent({
          setup() {
            const { add, close } = useToastManager();
            let id: string | null = null;
            return () => (
              <Fragment>
                <button
                  onClick={() => {
                    id = add({
                      title: 'test',
                      onRemove: onRemoveSpy,
                    });
                  }}
                >
                  add
                </button>
                <button
                  onClick={() => {
                    if (id) {
                      close(id);
                    }
                  }}
                >
                  close
                </button>
              </Fragment>
            );
          },
        });

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <List />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const addButton = screen.getByRole('button', { name: 'add' });
        await fireEvent.click(addButton);

        expect(onRemoveSpy.mock.calls.length).toBe(0);

        const closeButton = screen.getByRole('button', { name: 'close' });
        await fireEvent.click(closeButton);

        expect(onRemoveSpy.mock.calls.length).toBe(1);
      });
    });

    describe('option: priority', () => {
      it('applies correct ARIA attributes for high priority toasts', async () => {
        const AddButton = defineComponent({
          setup() {
            const { add } = useToastManager();
            return () => (
              <button onClick={() => add({ title: 'high priority', priority: 'high' })}>
                add high
              </button>
            );
          },
        });

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <List />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const highPriorityButton = screen.getByRole('button', { name: 'add high' });
        await fireEvent.click(highPriorityButton);

        const highRoot = screen.getByTestId('root');

        expect(highRoot.getAttribute('role')).toBe('alertdialog');
        expect(highRoot.getAttribute('aria-modal')).toBe('false');
        expect(screen.getByRole('alert')).not.toBe(null);
        expect(screen.getByRole('alert').getAttribute('aria-atomic')).toBe('true');

        const closeHighButton = screen.getByLabelText('close-press');
        await fireEvent.click(closeHighButton);

        expect(screen.queryByRole('alert')).toBe(null);
      });
    });
  });

  describe('promise', () => {
    const { render } = createRenderer();

    const CustomList = defineComponent({
      setup() {
        const { toasts } = useToastManager();
        return () =>
          toasts.value.map((t) => (
            <Toast.Root key={t.id} toast={t} data-testid="root">
              <Toast.Title data-testid="title" />
              <Toast.Description data-testid="description" />
              <Toast.Close aria-label="close-press" />
              <span>{t.type}</span>
            </Toast.Root>
          ));
      },
    });

    it('displays success state as description after promise resolves', async () => {
      const AddButton = defineComponent({
        setup() {
          const { promise } = useToastManager();
          return () => (
            <button
              onClick={() => {
                void promise(
                  new Promise((res) => {
                    setTimeout(() => {
                      res('success');
                    }, 1000);
                  }),
                  {
                    loading: 'loading',
                    success: 'success',
                    error: 'error',
                  },
                );
              }}
            >
              add
            </button>
          );
        },
      });

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <CustomList />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      await fireEvent.click(button);

      expect(screen.getByTestId('description')).toHaveTextContent('loading');

      await tick(1000);

      expect(screen.getByTestId('description')).toHaveTextContent('success');
    });

    it('displays error state as description after promise rejects', async () => {
      const AddButton = defineComponent({
        setup() {
          const { promise } = useToastManager();
          return () => (
            <button
              onClick={() => {
                promise(
                  new Promise((res, rej) => {
                    setTimeout(() => {
                      rej(new Error('error'));
                    }, 1000);
                  }),
                  {
                    loading: 'loading',
                    success: 'success',
                    error: 'error',
                  },
                ).catch(() => {
                  // Explicitly catch rejection to prevent test failure
                });
              }}
            >
              add
            </button>
          );
        },
      });

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <CustomList />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      await fireEvent.click(button);

      expect(screen.getByTestId('description')).toHaveTextContent('loading');

      await tick(1000);

      expect(screen.getByTestId('description')).toHaveTextContent('error');
    });

    it('passes data when success is a function', async () => {
      const AddButton = defineComponent({
        setup() {
          const { promise } = useToastManager();
          return () => (
            <button
              onClick={() =>
                void promise(
                  new Promise((res) => {
                    res('test success');
                  }),
                  {
                    loading: 'loading',
                    success: (data) => String(data),
                    error: 'error',
                  },
                )
              }
            >
              add
            </button>
          );
        },
      });

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <CustomList />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      const texts = recordTextContent('description');
      await fireEvent.click(button);

      expect(texts.description[0]).toBe('loading');

      await tick(1000);

      expect(screen.getByTestId('description')).toHaveTextContent('test success');
    });

    it('accepts a function that returns full options for the success state', async () => {
      const AddButton = defineComponent({
        setup() {
          const { promise } = useToastManager();
          return () => (
            <button
              onClick={() =>
                void promise(
                  new Promise<string>((res) => {
                    res('everything');
                  }),
                  {
                    loading: 'loading',
                    success: (data) => ({
                      title: `saved ${data}`,
                      description: 'done',
                      timeout: 2000,
                    }),
                    error: 'error',
                  },
                )
              }
            >
              add
            </button>
          );
        },
      });

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <CustomList />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      // The click of Base UI returns before the promise settles, so the success state starts its
      // timer after the first tick. An awaited click would settle the promise first.
      const click = fireEvent.click(screen.getByRole('button', { name: 'add' }));

      await tick(1000);
      await click;

      expect(screen.getByTestId('title')).toHaveTextContent('saved everything');
      expect(screen.getByTestId('description')).toHaveTextContent('done');

      // The `timeout` from the resolved options object is honored too.
      await tick(1999);
      expect(screen.queryByTestId('root')).not.toBe(null);

      await tick(2);
      expect(screen.queryByTestId('root')).toBe(null);
    });

    it('passes data when error is a function', async () => {
      const AddButton = defineComponent({
        setup() {
          const { promise } = useToastManager();
          return () => (
            <button
              onClick={() =>
                void promise(
                  new Promise((res, rej) => {
                    rej(new Error('test error'));
                  }),
                  {
                    loading: 'loading',
                    success: 'success',
                    error: (error: Error) => `${error.message}`,
                  },
                ).catch(() => {
                  // Explicitly catch rejection to prevent test failure
                })
              }
            >
              add
            </button>
          );
        },
      });

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <CustomList />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      const texts = recordTextContent('description');
      await fireEvent.click(button);

      expect(texts.description[0]).toBe('loading');

      await tick(1000);

      expect(screen.getByTestId('description')).toHaveTextContent('test error');
    });

    it('supports custom options', async () => {
      const AddButton = defineComponent({
        setup() {
          const { promise } = useToastManager();
          return () => (
            <button
              onClick={() =>
                void promise(
                  new Promise((res) => {
                    res('success');
                  }),
                  {
                    loading: {
                      title: 'loading title',
                      description: 'loading description',
                    },
                    success: 'success',
                    error: 'error',
                  },
                )
              }
            >
              add
            </button>
          );
        },
      });

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <CustomList />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      const texts = recordTextContent('title', 'description');
      await fireEvent.click(button);

      expect(texts.title[0]).toBe('loading title');
      expect(texts.description[0]).toBe('loading description');

      await flushMicrotasks();
    });

    it('does not reopen a dismissed promise toast when it resolves', async () => {
      let resolvePromise: (value: string) => void = () => {
        throw new Error('Promise resolver should be assigned before resolving.');
      };

      const AddButton = defineComponent({
        setup() {
          const { promise } = useToastManager();
          return () => (
            <button
              onClick={() => {
                const pendingPromise = new Promise<string>((resolve) => {
                  resolvePromise = resolve;
                });

                void promise(pendingPromise, {
                  loading: 'loading',
                  success: 'success',
                  error: 'error',
                });
              }}
            >
              add
            </button>
          );
        },
      });

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <CustomList />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add' }));

      expect(screen.getByTestId('description')).toHaveTextContent('loading');

      await fireEvent.click(screen.getByLabelText('close-press'));
      resolvePromise('success');

      await flushMicrotasks();

      expect(screen.queryByTestId('root')).toBe(null);
    });

    describe('timeout handling', () => {
      it('auto-dismisses success toast after default timeout when promise resolves', async () => {
        const AddButton = defineComponent({
          setup() {
            const { promise } = useToastManager();
            return () => (
              <button
                onClick={() => {
                  void promise(
                    new Promise((res) => {
                      setTimeout(() => {
                        res('success');
                      }, 1000);
                    }),
                    {
                      loading: 'loading',
                      success: 'success',
                      error: 'error',
                    },
                  );
                }}
              >
                add
              </button>
            );
          },
        });

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <CustomList />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const button = screen.getByRole('button', { name: 'add' });
        await fireEvent.click(button);

        expect(screen.getByTestId('description')).toHaveTextContent('loading');

        await tick(1000);

        expect(screen.getByTestId('description')).toHaveTextContent('success');

        await tick(5000);

        expect(screen.queryByTestId('root')).toBe(null);
      });

      it('auto-dismisses error toast after default timeout when promise rejects', async () => {
        const AddButton = defineComponent({
          setup() {
            const { promise } = useToastManager();
            return () => (
              <button
                onClick={() => {
                  promise(
                    new Promise((res, rej) => {
                      setTimeout(() => {
                        rej(new Error('error'));
                      }, 1000);
                    }),
                    {
                      loading: 'loading',
                      success: 'success',
                      error: 'error',
                    },
                  ).catch(() => {
                    // Explicitly catch rejection to prevent test failure
                  });
                }}
              >
                add
              </button>
            );
          },
        });

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <CustomList />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const button = screen.getByRole('button', { name: 'add' });
        await fireEvent.click(button);

        expect(screen.getByTestId('description')).toHaveTextContent('loading');

        await tick(1000);

        expect(screen.getByTestId('description')).toHaveTextContent('error');

        await tick(5000);
        expect(screen.queryByTestId('root')).toBe(null);
      });

      it('uses custom timeout from success options when promise resolves', async () => {
        const AddButton = defineComponent({
          setup() {
            const { promise } = useToastManager();
            return () => (
              <button
                onClick={() => {
                  void promise(
                    new Promise((res) => {
                      setTimeout(() => {
                        res('success');
                      }, 1000);
                    }),
                    {
                      loading: 'loading',
                      success: {
                        description: 'success',
                        timeout: 2000,
                      },
                      error: 'error',
                    },
                  );
                }}
              >
                add
              </button>
            );
          },
        });

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <CustomList />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const button = screen.getByRole('button', { name: 'add' });
        await fireEvent.click(button);

        await tick(1000);

        expect(screen.getByTestId('description')).toHaveTextContent('success');

        await tick(1000);
        expect(screen.getByTestId('root')).not.toBe(null);

        await tick(1000);
        expect(screen.queryByTestId('root')).toBe(null);
      });

      it('uses custom timeout from error options when promise rejects', async () => {
        const AddButton = defineComponent({
          setup() {
            const { promise } = useToastManager();
            return () => (
              <button
                onClick={() => {
                  promise(
                    new Promise((res, rej) => {
                      setTimeout(() => {
                        rej(new Error('error'));
                      }, 1000);
                    }),
                    {
                      loading: 'loading',
                      success: 'success',
                      error: {
                        description: 'error',
                        timeout: 3000,
                      },
                    },
                  ).catch(() => {
                    // Explicitly catch rejection to prevent test failure
                  });
                }}
              >
                add
              </button>
            );
          },
        });

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <CustomList />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const button = screen.getByRole('button', { name: 'add' });
        await fireEvent.click(button);

        await tick(1000);

        expect(screen.getByTestId('description')).toHaveTextContent('error');

        await tick(2000);
        expect(screen.getByTestId('root')).not.toBe(null);

        await tick(1000);
        expect(screen.queryByTestId('root')).toBe(null);
      });

      it('uses provider timeout when no custom timeout is specified', async () => {
        const AddButton = defineComponent({
          setup() {
            const { promise } = useToastManager();
            return () => (
              <button
                onClick={() => {
                  void promise(
                    new Promise((res) => {
                      setTimeout(() => {
                        res('success');
                      }, 1000);
                    }),
                    {
                      loading: 'loading',
                      success: 'success',
                      error: 'error',
                    },
                  );
                }}
              >
                add
              </button>
            );
          },
        });

        await render(
          <Toast.Provider timeout={1000}>
            <Toast.Viewport>
              <CustomList />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const button = screen.getByRole('button', { name: 'add' });
        await fireEvent.click(button);

        await tick(1000);

        expect(screen.getByTestId('description')).toHaveTextContent('success');

        await tick(1000);
        expect(screen.queryByTestId('root')).toBe(null);
      });

      it('does not inherit a loading timeout when success does not specify one', async () => {
        const AddButton = defineComponent({
          setup() {
            const { promise } = useToastManager();
            return () => (
              <button
                onClick={() => {
                  void promise(
                    new Promise((res) => {
                      setTimeout(() => {
                        res('success');
                      }, 1000);
                    }),
                    {
                      loading: {
                        description: 'loading',
                        timeout: 0,
                      },
                      success: 'success',
                      error: 'error',
                    },
                  );
                }}
              >
                add
              </button>
            );
          },
        });

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <CustomList />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        await fireEvent.click(screen.getByRole('button', { name: 'add' }));
        expect(screen.getByTestId('description')).toHaveTextContent('loading');

        await tick(1000);
        expect(screen.getByTestId('description')).toHaveTextContent('success');

        await tick(5000);
        expect(screen.queryByTestId('root')).toBe(null);
      });

      it('does not auto-dismiss when timeout is set to 0', async () => {
        const AddButton = defineComponent({
          setup() {
            const { promise } = useToastManager();
            return () => (
              <button
                onClick={() => {
                  void promise(
                    new Promise((res) => {
                      setTimeout(() => {
                        res('success');
                      }, 1000);
                    }),
                    {
                      loading: 'loading',
                      success: {
                        description: 'success',
                        timeout: 0,
                      },
                      error: 'error',
                    },
                  );
                }}
              >
                add
              </button>
            );
          },
        });

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <CustomList />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const button = screen.getByRole('button', { name: 'add' });
        await fireEvent.click(button);

        await tick(1000);

        expect(screen.getByTestId('description')).toHaveTextContent('success');

        await tick(10000);
        expect(screen.getByTestId('root')).not.toBe(null);
      });

      it('pauses timers when hovering over toast', async () => {
        const AddButton = defineComponent({
          setup() {
            const { promise } = useToastManager();
            return () => (
              <button
                onClick={() => {
                  void promise(
                    new Promise((res) => {
                      setTimeout(() => {
                        res('success');
                      }, 1000);
                    }),
                    {
                      loading: 'loading',
                      success: {
                        description: 'success',
                        timeout: 3000,
                      },
                      error: 'error',
                    },
                  );
                }}
              >
                add
              </button>
            );
          },
        });

        await render(
          <Toast.Provider>
            <Toast.Viewport data-testid="viewport">
              <CustomList />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const button = screen.getByRole('button', { name: 'add' });
        await fireEvent.click(button);

        await tick(1000);

        expect(screen.getByTestId('description')).toHaveTextContent('success');

        await tick(1000);

        const viewport = screen.getByTestId('viewport');
        await fireEvent.mouseEnter(viewport);

        await tick(5000);
        expect(screen.getByTestId('root')).not.toBe(null);

        await fireEvent.mouseLeave(viewport);
        await tick(2000);
        expect(screen.queryByTestId('root')).toBe(null);
      });
    });
  });

  describe('update', () => {
    const { render } = createRenderer();

    const CustomList = defineComponent({
      setup() {
        const { toasts } = useToastManager();
        return () =>
          toasts.value.map((t) => (
            <Toast.Root key={t.id} toast={t} data-testid="root">
              <Toast.Title data-testid="title" />
            </Toast.Root>
          ));
      },
    });

    it('updates the toast', async () => {
      const AddButton = defineComponent({
        setup() {
          const { add, update } = useToastManager();
          let id: string | null = null;
          return () => (
            <>
              <button
                type="button"
                onClick={() => {
                  id = add({ title: 'test' });
                }}
              >
                add
              </button>
              <button
                type="button"
                onClick={() => {
                  if (id) {
                    update(id, { title: 'updated' });
                  }
                }}
              >
                update
              </button>
            </>
          );
        },
      });

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <CustomList />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      await fireEvent.click(button);

      expect(screen.getByTestId('title')).toHaveTextContent('test');

      const updateButton = screen.getByRole('button', { name: 'update' });
      await fireEvent.click(updateButton);

      expect(screen.getByTestId('title')).toHaveTextContent('updated');
    });

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

    it('auto-dismisses when timeout changes from 0 to a positive value', async () => {
      const AddButton = defineComponent({
        setup() {
          const { add, update } = useToastManager();
          let id: string | null = null;
          return () => (
            <>
              <button
                type="button"
                onClick={() => {
                  id = add({ title: 'test', timeout: 0 });
                }}
              >
                add
              </button>
              <button
                type="button"
                onClick={() => {
                  if (id) {
                    update(id, { timeout: 1000 });
                  }
                }}
              >
                update
              </button>
            </>
          );
        },
      });

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <CustomList />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.queryByTestId('root')).not.toBe(null);

      await fireEvent.click(screen.getByRole('button', { name: 'update' }));
      await tick(1000);

      expect(screen.queryByTestId('root')).toBe(null);
    });

    it('schedules a timer when updating a loading toast to a non-loading type', async () => {
      const AddButton = defineComponent({
        setup() {
          const { add, update } = useToastManager();
          let id: string | null = null;
          return () => (
            <>
              <button
                type="button"
                onClick={() => {
                  id = add({ title: 'loading', type: 'loading' });
                }}
              >
                add
              </button>
              <button
                type="button"
                onClick={() => {
                  if (id) {
                    update(id, { title: 'success', type: 'success', timeout: 1000 });
                  }
                }}
              >
                update
              </button>
            </>
          );
        },
      });

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <CustomList />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.getByTestId('title')).toHaveTextContent('loading');

      await fireEvent.click(screen.getByRole('button', { name: 'update' }));
      expect(screen.getByTestId('title')).toHaveTextContent('success');

      await tick(1000);
      expect(screen.queryByTestId('root')).toBe(null);
    });
  });

  describe('close', () => {
    const { render } = createRenderer();

    const CustomList = defineComponent({
      setup() {
        const { toasts } = useToastManager();
        return () =>
          toasts.value.map((t) => (
            <Toast.Root key={t.id} toast={t} data-testid="root">
              <Toast.Title data-testid="title" />
            </Toast.Root>
          ));
      },
    });

    it('closes a toast', async () => {
      const AddButton = defineComponent({
        setup() {
          const { add, close } = useToastManager();
          let id: string | null = null;
          return () => (
            <>
              <button
                onClick={() => {
                  id = add({ title: 'test' });
                }}
              >
                add
              </button>
              <button
                onClick={() => {
                  if (id) {
                    close(id);
                  }
                }}
              >
                close
              </button>
            </>
          );
        },
      });

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <CustomList />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      const addButton = screen.getByRole('button', { name: 'add' });
      await fireEvent.click(addButton);

      expect(screen.getByTestId('root')).not.toBe(null);

      const closeButton = screen.getByRole('button', { name: 'close' });
      await fireEvent.click(closeButton);

      expect(screen.queryByTestId('root')).toBe(null);
    });

    it('closes all toasts', async () => {
      const AddButton = defineComponent({
        setup() {
          const { add, close } = useToastManager();
          return () => (
            <>
              <button
                onClick={() => {
                  add({ title: 'test' });
                }}
              >
                add
              </button>
              <button
                onClick={() => {
                  close();
                }}
              >
                close
              </button>
            </>
          );
        },
      });

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <CustomList />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      const addButton = screen.getByRole('button', { name: 'add' });
      for (let index = 0; index < 5; index += 1) {
        await fireEvent.click(addButton);
      }

      expect(screen.getAllByTestId('root')).toHaveLength(5);

      const closeButton = screen.getByRole('button', { name: 'close' });
      await fireEvent.click(closeButton);

      expect(screen.queryByTestId('root')).toBe(null);
    });
  });

  describe('prop: timeout', () => {
    const { render } = createRenderer();

    it('applies a changed timeout to toasts added afterwards', async () => {
      const AddButton = defineComponent({
        setup() {
          const { add } = useToastManager();
          return () => <button onClick={() => add({ title: 'test' })}>add</button>;
        },
      });

      const App = defineComponent({
        props: { timeout: { type: Number, required: true } },
        setup(props) {
          return () => (
            <Toast.Provider timeout={props.timeout}>
              <Toast.Viewport>
                <List />
              </Toast.Viewport>
              <AddButton />
            </Toast.Provider>
          );
        },
      });

      const { setProps } = await render(<App timeout={5000} />);

      await setProps({ timeout: 1000 });

      await fireEvent.click(screen.getByRole('button', { name: 'add' }));

      await tick(999);
      expect(screen.queryByTestId('root')).not.toBe(null);

      await tick(2);
      expect(screen.queryByTestId('root')).toBe(null);
    });
  });

  describe('prop: limit', () => {
    const { render } = createRenderer();

    const TestList = defineComponent({
      setup() {
        const count = shallowRef(0);
        const { toasts, add } = useToastManager();
        return () => (
          <>
            {toasts.value.map((t) => (
              <Toast.Root key={t.id} toast={t} data-testid={t.title}>
                <Toast.Close data-testid={`close-${String(t.title)}`} />
              </Toast.Root>
            ))}
            <button
              onClick={() => {
                const nextCount = count.value + 1;
                count.value = nextCount;
                add({ title: `toast-${nextCount}` });
              }}
            >
              add
            </button>
          </>
        );
      },
    });

    it('marks toasts as limited when the limit is exceeded', async () => {
      await render(
        <Toast.Provider limit={2}>
          <Toast.Viewport>
            <TestList />
          </Toast.Viewport>
        </Toast.Provider>,
      );

      const addButton = screen.getByRole('button', { name: 'add' });

      await fireEvent.click(addButton);
      const toast1 = screen.getByTestId('toast-1');
      expect(toast1).not.toHaveAttribute('data-limited');

      await fireEvent.click(addButton);
      const toast2 = screen.getByTestId('toast-2');
      expect(toast2).not.toHaveAttribute('data-limited');

      await fireEvent.click(addButton);
      const toast3 = screen.getByTestId('toast-3');
      expect(toast3).not.toHaveAttribute('data-limited');
      expect(toast1).toHaveAttribute('data-limited');
    });

    it('unmarks toasts as limited when the limit is not exceeded', async () => {
      await render(
        <Toast.Provider limit={2}>
          <Toast.Viewport>
            <TestList />
          </Toast.Viewport>
        </Toast.Provider>,
      );

      const addButton = screen.getByRole('button', { name: 'add' });

      await fireEvent.click(addButton);
      const toast1 = screen.getByTestId('toast-1');
      expect(toast1).not.toHaveAttribute('data-limited');

      await fireEvent.click(addButton);
      const toast2 = screen.getByTestId('toast-2');
      expect(toast2).not.toHaveAttribute('data-limited');

      await fireEvent.click(addButton);
      const toast3 = screen.getByTestId('toast-3');
      expect(toast3).not.toHaveAttribute('data-limited');

      const closeToast3 = screen.getByTestId('close-toast-3');
      await fireEvent.click(closeToast3);

      expect(toast1).not.toHaveAttribute('data-limited');
    });

    it('preserves limited state when upserting a limited toast', async () => {
      const LimitedToastExample = defineComponent({
        setup() {
          const { add, toasts } = useToastManager();

          return () => (
            <>
              {toasts.value.map((toast) => (
                <Toast.Root key={toast.id} toast={toast} data-testid={String(toast.title)}>
                  <Toast.Title />
                </Toast.Root>
              ))}
              <button
                onClick={() => {
                  add({ id: 'save', title: 'Saving…', timeout: 0 });
                }}
              >
                add save
              </button>
              <button
                onClick={() => {
                  add({ id: 'other', title: 'Other toast', timeout: 0 });
                }}
              >
                add other
              </button>
              <button
                onClick={() => {
                  add({ id: 'save', title: 'Saved', timeout: 0 });
                }}
              >
                upsert save
              </button>
            </>
          );
        },
      });

      await render(
        <Toast.Provider limit={1}>
          <Toast.Viewport>
            <LimitedToastExample />
          </Toast.Viewport>
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add save' }));
      const savingToast = screen.getByTestId('Saving…');
      expect(savingToast).not.toHaveAttribute('data-limited');

      await fireEvent.click(screen.getByRole('button', { name: 'add other' }));
      expect(savingToast).toHaveAttribute('data-limited');
      expect(screen.getByTestId('Other toast')).not.toHaveAttribute('data-limited');

      await fireEvent.click(screen.getByRole('button', { name: 'upsert save' }));
      const savedToast = screen.getByTestId('Saved');
      expect(savedToast).toHaveAttribute('data-limited');
      expect(screen.getByTestId('Other toast')).not.toHaveAttribute('data-limited');
    });

    it('recomputes limited toasts when the limit prop changes', async () => {
      const App = defineComponent({
        props: { limit: { type: Number, required: true } },
        setup(props) {
          return () => (
            <Toast.Provider limit={props.limit}>
              <Toast.Viewport>
                <TestList />
              </Toast.Viewport>
            </Toast.Provider>
          );
        },
      });

      const { setProps } = await render(<App limit={1} />);

      const addButton = screen.getByRole('button', { name: 'add' });
      await fireEvent.click(addButton);
      await fireEvent.click(addButton);

      const toast1 = screen.getByTestId('toast-1');
      const toast2 = screen.getByTestId('toast-2');

      expect(toast2).not.toHaveAttribute('data-limited');
      expect(toast1).toHaveAttribute('data-limited');

      // Raising the limit un-limits the older toast.
      await setProps({ limit: 2 });
      expect(toast1).not.toHaveAttribute('data-limited');

      // Lowering it again re-limits it.
      await setProps({ limit: 1 });
      expect(toast1).toHaveAttribute('data-limited');
    });
  });

  describe('in dialog', () => {
    const { render } = createRenderer();

    const DialogToastExample = defineComponent({
      setup() {
        const { add } = useToastManager();
        const isOpen = shallowRef(false);

        return () => (
          <>
            <button
              onClick={() => {
                isOpen.value = true;
              }}
            >
              open dialog
            </button>
            <Dialog.Root
              open={isOpen.value}
              onOpenChange={(open: boolean) => {
                isOpen.value = open;
              }}
            >
              <Dialog.Portal>
                <Dialog.Backdrop />
                <Dialog.Popup>
                  <button
                    onClick={() =>
                      add({
                        title: 'Toast in dialog',
                        description: 'This toast is in a dialog',
                      })
                    }
                  >
                    add
                  </button>
                  <Dialog.Close />
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </>
        );
      },
    });

    const ToastInDialogList = defineComponent({
      setup() {
        const { toasts } = useToastManager();
        return () =>
          toasts.value.map((toast) => (
            <Toast.Root key={toast.id} toast={toast} data-testid="toast-root">
              <Toast.Title data-testid="toast-title">{toast.title}</Toast.Title>
              <Toast.Description data-testid="toast-description">
                {toast.description}
              </Toast.Description>
              <Toast.Close data-testid="toast-close" aria-label="close" />
            </Toast.Root>
          ));
      },
    });

    it('toasts in dialogs are accessible and not aria-hidden', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <ToastInDialogList />
          </Toast.Viewport>
          <DialogToastExample />
        </Toast.Provider>,
      );

      const openDialogButton = screen.getByRole('button', { name: 'open dialog' });
      await fireEvent.click(openDialogButton);

      expect(screen.getByRole('dialog')).not.toBe(null);
      await waitForLaterMillisecond();

      const addToastButton = screen.getByRole('button', { name: 'add' });
      await fireEvent.click(addToastButton);

      const toastRoot = screen.getByTestId('toast-root');
      expect(toastRoot).not.toBe(null);
      expect(screen.getByTestId('toast-title')).toHaveTextContent('Toast in dialog');
      expect(screen.getByTestId('toast-description')).toHaveTextContent(
        'This toast is in a dialog',
      );
    });

    it('high priority toasts in dialogs have correct accessibility structure', async () => {
      const HighPriorityToastInDialog = defineComponent({
        setup() {
          const { add } = useToastManager();
          return () => (
            <Dialog.Root open>
              <Dialog.Portal>
                <Dialog.Backdrop />
                <Dialog.Popup>
                  <button
                    onClick={() => {
                      add({
                        title: 'High priority toast',
                        description: 'This is urgent',
                        priority: 'high',
                      });
                    }}
                  >
                    add
                  </button>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          );
        },
      });

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <ToastInDialogList />
          </Toast.Viewport>
          <HighPriorityToastInDialog />
        </Toast.Provider>,
      );

      const addToastButton = screen.getByRole('button', { name: 'add' });
      await fireEvent.click(addToastButton);

      const toastRoot = screen.getByTestId('toast-root');
      expect(toastRoot).toHaveAttribute('aria-hidden', 'true');
      expect(screen.queryByRole('alert')).not.toBe(null);
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
