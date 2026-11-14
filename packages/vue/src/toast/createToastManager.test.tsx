import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, Fragment } from 'vue';
import { createRenderer, fireEvent, flushMicrotasks, screen } from '#test-utils';
import * as Toast from './index.parts';
import type { ToastObject } from './useToastManager';
import { List } from './utils/test-utils';

async function tickAsync(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
  await flushMicrotasks();
}

describe('createToastManager', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('add', () => {
    it('adds a toast', async () => {
      const toastManager = Toast.createToastManager();

      function add() {
        toastManager.add({
          title: 'title',
        });
      }

      const AddButton = defineComponent({
        setup: () => () => (
          <button type="button" onClick={add}>
            add
          </button>
        ),
      });

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      expect(screen.queryByTestId('title')).toBe(null);

      const button = screen.getByRole('button', { name: 'add' });
      await fireEvent.click(button);

      expect(screen.queryByTestId('title')).not.toBe(null);

      await tickAsync(5000);

      expect(screen.queryByTestId('title')).toBe(null);
    });

    it('returns a toast id', () => {
      const toastManager = Toast.createToastManager();

      const toastId = toastManager.add({
        title: 'title',
      });

      expect(toastId).toBeTypeOf('string');
    });

    it('upserts a toast when adding with an existing id', async () => {
      const toastManager = Toast.createToastManager();
      let firstToastId = '';
      let secondToastId = '';

      const Buttons = defineComponent({
        setup: () => () => (
          <Fragment>
            <button
              type="button"
              onClick={() => {
                firstToastId = toastManager.add({
                  id: 'save',
                  title: 'Saving…',
                  timeout: 1000,
                });
              }}
            >
              add
            </button>
            <button
              type="button"
              onClick={() => {
                secondToastId = toastManager.add({
                  id: 'save',
                  title: 'Saved',
                  timeout: 1000,
                });
              }}
            >
              upsert
            </button>
          </Fragment>
        ),
      });

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add' }));

      expect(screen.getByTestId('title')).toHaveTextContent('Saving…');
      expect(screen.queryAllByTestId('root')).toHaveLength(1);

      await tickAsync(900);

      await fireEvent.click(screen.getByRole('button', { name: 'upsert' }));

      expect(firstToastId).toBe('save');
      expect(secondToastId).toBe(firstToastId);
      expect(screen.getByTestId('title')).toHaveTextContent('Saved');
      expect(screen.queryAllByTestId('root')).toHaveLength(1);

      await tickAsync(200);
      expect(screen.queryByTestId('title')).not.toBe(null);

      await tickAsync(800);
      expect(screen.queryByTestId('title')).toBe(null);
    });
  });

  describe('promise', () => {
    it('adds a toast with the loading state that is updated with the success state', async () => {
      const toastManager = Toast.createToastManager();

      function add() {
        void toastManager.promise(
          new Promise((resolve) => {
            setTimeout(() => {
              resolve('success');
            }, 1000);
          }),
          {
            loading: 'loading',
            success: 'success',
            error: 'error',
          },
        );
      }

      const AddButton = defineComponent({
        setup: () => () => (
          <button type="button" onClick={add}>
            add
          </button>
        ),
      });

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      await fireEvent.click(button);
      await flushMicrotasks();

      expect(screen.queryByTestId('description')).toHaveTextContent('loading');

      await tickAsync(1000);

      expect(screen.queryByTestId('description')).toHaveTextContent('success');
    });

    it('does not inherit a loading timeout when success does not specify one', async () => {
      const toastManager = Toast.createToastManager();

      function add() {
        void toastManager.promise(
          new Promise((resolve) => {
            setTimeout(() => {
              resolve('success');
            }, 1000);
          }),
          {
            loading: {
              description: 'loading',
              timeout: 0,
            },
            success: {
              description: 'success',
            },
            error: 'error',
          },
        );
      }

      const AddButton = defineComponent({
        setup: () => () => (
          <button type="button" onClick={add}>
            add
          </button>
        ),
      });

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add' }));
      await flushMicrotasks();

      expect(screen.queryByTestId('description')).toHaveTextContent('loading');

      await tickAsync(1000);

      expect(screen.queryByTestId('description')).toHaveTextContent('success');

      await tickAsync(5000);

      expect(screen.queryByTestId('description')).toBe(null);
    });

    it('adds a toast with the loading state that is updated with the error state', async () => {
      const toastManager = Toast.createToastManager();

      function promise() {
        toastManager
          .promise(
            new Promise((res, rej) => {
              rej(new Error('error'));
            }),
            {
              loading: 'loading',
              success: 'success',
              error: 'error',
            },
          )
          .catch(() => {
            // Swallow the error
          });
      }

      const AddButton = defineComponent({
        setup: () => () => (
          <button type="button" onClick={promise}>
            add
          </button>
        ),
      });

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      await fireEvent.click(button);
      await flushMicrotasks();

      expect(screen.getByTestId('description')).toHaveTextContent('error');
    });

    it('does not reopen a dismissed promise toast when it resolves', async () => {
      const toastManager = Toast.createToastManager();
      let resolvePromise: (value: string) => void = () => {
        throw new Error('Promise resolver should be assigned before resolving.');
      };

      function add() {
        const pendingPromise = new Promise<string>((resolve) => {
          resolvePromise = resolve;
        });

        void toastManager.promise(pendingPromise, {
          loading: 'loading',
          success: 'success',
          error: 'error',
        });
      }

      const Button = defineComponent({
        setup: () => () => (
          <button type="button" onClick={add}>
            add
          </button>
        ),
      });

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add' }));

      expect(screen.getByTestId('description')).toHaveTextContent('loading');

      await fireEvent.click(screen.getByLabelText('close-press'));
      resolvePromise('success');

      await flushMicrotasks();

      expect(screen.queryByTestId('title')).toBe(null);
    });
  });

  describe('update', () => {
    it('updates a toast', async () => {
      const toastManager = Toast.createToastManager();

      let toastId: string;

      function add() {
        toastId = toastManager.add({
          title: 'title',
        });
      }

      function update() {
        toastManager.update(toastId, {
          title: 'updated',
        });
      }

      const Buttons = defineComponent({
        setup: () => () => (
          <Fragment>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={update}>
              update method
            </button>
          </Fragment>
        ),
      });

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      await fireEvent.click(button);

      const updateButton = screen.getByRole('button', { name: 'update method' });
      await fireEvent.click(updateButton);

      expect(screen.getByTestId('title')).toHaveTextContent('updated');
    });

    it('derives the update from the current toast when given a function', async () => {
      const toastManager = Toast.createToastManager<{ count: number }>();

      let toastId: string;
      const updater = vi.fn((prevToast: ToastObject<{ count: number }>) => ({
        title: `${String(prevToast.title)} updated`,
        data: { count: prevToast.data!.count + 1 },
      }));

      function add() {
        toastId = toastManager.add({ title: 'title', data: { count: 1 } });
      }

      function update() {
        toastManager.update(toastId, updater);
      }

      const Buttons = defineComponent({
        setup: () => () => (
          <Fragment>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={update}>
              update method
            </button>
          </Fragment>
        ),
      });

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add' }));
      await fireEvent.click(screen.getByRole('button', { name: 'update method' }));

      expect(updater).toHaveBeenCalledTimes(1);
      expect(updater.mock.calls[0][0].data).toEqual({ count: 1 });
      expect(screen.getByTestId('title')).toHaveTextContent('title updated');
    });

    it('resets the auto-dismiss timer when updating with the same timeout value', async () => {
      const toastManager = Toast.createToastManager();

      let toastId: string;

      function add() {
        toastId = toastManager.add({
          title: 'title',
          timeout: 1000,
        });
      }

      function resetTimeout() {
        toastManager.update(toastId, {
          timeout: 1000,
        });
      }

      const Buttons = defineComponent({
        setup: () => () => (
          <Fragment>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={resetTimeout}>
              reset timeout
            </button>
          </Fragment>
        ),
      });

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.queryByTestId('title')).not.toBe(null);

      await tickAsync(900);
      expect(screen.queryByTestId('title')).not.toBe(null);

      await fireEvent.click(screen.getByRole('button', { name: 'reset timeout' }));

      await tickAsync(200);
      expect(screen.queryByTestId('title')).not.toBe(null);

      await tickAsync(800);
      expect(screen.queryByTestId('title')).toBe(null);
    });

    it('resets the auto-dismiss timer when updating from 0 to a timeout, then updating with the same timeout again', async () => {
      const toastManager = Toast.createToastManager();

      let toastId: string;

      function add() {
        toastId = toastManager.add({
          title: 'title',
          timeout: 0,
        });
      }

      function setTimeoutTo1000() {
        toastManager.update(toastId, {
          timeout: 1000,
        });
      }

      function resetTimeoutTo1000() {
        toastManager.update(toastId, {
          timeout: 1000,
        });
      }

      const Buttons = defineComponent({
        setup: () => () => (
          <Fragment>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={setTimeoutTo1000}>
              set timeout
            </button>
            <button type="button" onClick={resetTimeoutTo1000}>
              reset timeout
            </button>
          </Fragment>
        ),
      });

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.queryByTestId('title')).not.toBe(null);

      await fireEvent.click(screen.getByRole('button', { name: 'set timeout' }));

      await tickAsync(900);
      expect(screen.queryByTestId('title')).not.toBe(null);

      await fireEvent.click(screen.getByRole('button', { name: 'reset timeout' }));

      await tickAsync(200);
      expect(screen.queryByTestId('title')).not.toBe(null);

      await tickAsync(800);
      expect(screen.queryByTestId('title')).toBe(null);
    });

    it('auto-dismisses when updating timeout from 0 to a positive value', async () => {
      const toastManager = Toast.createToastManager();

      let toastId: string;

      function add() {
        toastId = toastManager.add({
          title: 'title',
          timeout: 0,
        });
      }

      function update() {
        toastManager.update(toastId, {
          timeout: 1000,
        });
      }

      const Buttons = defineComponent({
        setup: () => () => (
          <Fragment>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={update}>
              update method
            </button>
          </Fragment>
        ),
      });

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.queryByTestId('title')).not.toBe(null);

      await fireEvent.click(screen.getByRole('button', { name: 'update method' }));
      await tickAsync(1000);

      expect(screen.queryByTestId('title')).toBe(null);
    });

    it('schedules a timer when updating a loading toast to a non-loading type', async () => {
      const toastManager = Toast.createToastManager();

      let toastId: string;

      function add() {
        toastId = toastManager.add({
          title: 'loading',
          type: 'loading',
        });
      }

      function update() {
        toastManager.update(toastId, {
          title: 'success',
          type: 'success',
          timeout: 1000,
        });
      }

      const Buttons = defineComponent({
        setup: () => () => (
          <Fragment>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={update}>
              update method
            </button>
          </Fragment>
        ),
      });

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.getByTestId('title')).toHaveTextContent('loading');

      await fireEvent.click(screen.getByRole('button', { name: 'update method' }));
      expect(screen.getByTestId('title')).toHaveTextContent('success');

      await tickAsync(1000);

      expect(screen.queryByTestId('title')).toBe(null);
    });

    it('does not clear the auto-dismiss timer when updated twice before a re-render', async () => {
      const toastManager = Toast.createToastManager();

      let toastId: string;

      function add() {
        toastId = toastManager.add({
          title: 'loading',
          type: 'loading',
        });
      }

      function doubleUpdate() {
        toastManager.update(toastId, {
          type: 'success',
          timeout: 1000,
        });

        toastManager.update(toastId, {
          title: 'new',
        });
      }

      const Buttons = defineComponent({
        setup: () => () => (
          <Fragment>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={doubleUpdate}>
              double update
            </button>
          </Fragment>
        ),
      });

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.getByTestId('title')).toHaveTextContent('loading');

      await fireEvent.click(screen.getByRole('button', { name: 'double update' }));
      expect(screen.getByTestId('title')).toHaveTextContent('new');

      await tickAsync(1000);

      expect(screen.queryByTestId('title')).toBe(null);
    });
  });

  describe('close', () => {
    it('closes a toast', async () => {
      const toastManager = Toast.createToastManager();

      let toastId: string;

      function add() {
        toastId = toastManager.add({
          title: 'title',
        });
      }

      function close() {
        toastManager.close(toastId);
      }

      const Buttons = defineComponent({
        setup: () => () => (
          <Fragment>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={close}>
              close
            </button>
          </Fragment>
        ),
      });

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      await fireEvent.click(button);

      const closeButton = screen.getByRole('button', { name: 'close' });
      await fireEvent.click(closeButton);

      expect(screen.queryByTestId('title')).toBe(null);
    });

    it('closes all toasts', async () => {
      const toastManager = Toast.createToastManager();

      function add() {
        toastManager.add({ title: 'title' });
      }

      function close() {
        toastManager.close();
      }

      const Buttons = defineComponent({
        setup: () => () => (
          <Fragment>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={close}>
              close
            </button>
          </Fragment>
        ),
      });

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      for (let index = 0; index < 5; index += 1) {
        await fireEvent.click(button);
      }

      const closeButton = screen.getByRole('button', { name: 'close' });
      await fireEvent.click(closeButton);

      expect(screen.queryByTestId('title')).toBe(null);
    });

    it('does not call onClose when closing toasts that are already ending', async () => {
      const toastManager = Toast.createToastManager();
      const onCloseSpy1 = vi.fn(() => {
        toastManager.close();
      });
      const onCloseSpy2 = vi.fn();
      let toastId1: string;

      function add() {
        toastId1 = toastManager.add({
          title: 'toast 1',
          onClose: onCloseSpy1,
        });

        toastManager.add({
          title: 'toast 2',
          onClose: onCloseSpy2,
        });
      }

      function close() {
        toastManager.close(toastId1);
      }

      const Buttons = defineComponent({
        setup: () => () => (
          <Fragment>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={close}>
              close
            </button>
          </Fragment>
        ),
      });

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>,
      );

      await fireEvent.click(screen.getByRole('button', { name: 'add' }));
      await fireEvent.click(screen.getByRole('button', { name: 'close' }));

      expect(onCloseSpy1.mock.calls.length).toBe(1);
      expect(onCloseSpy2.mock.calls.length).toBe(1);
    });
  });
});
