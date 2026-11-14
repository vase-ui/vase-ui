import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import type { Component } from 'vue';
import { createRenderer, describeConformance, fireEvent, screen } from '#test-utils';
import type { HTMLProps } from '../../internals/types';
import * as Toast from '../index.parts';
import { List, Button } from '../utils/test-utils';

describe('<Toast.Action />', () => {
  const { render } = createRenderer();

  const toast: Toast.Root.ToastObject = {
    id: 'test',
    title: 'title',
  };

  describeConformance(<Toast.Action>action</Toast.Action>, () => ({
    refInstanceof: window.HTMLButtonElement,
    testRenderPropWith: 'button',
    button: true,
    render(node) {
      return render(
        <Toast.Provider>
          <Toast.Viewport>
            <Toast.Root toast={toast}>{node}</Toast.Root>
          </Toast.Viewport>
        </Toast.Provider>,
      );
    },
  }));

  it('performs an action when clicked', async () => {
    const onClick = vi.fn();

    const AddButton = defineComponent({
      setup() {
        const { add } = Toast.useToastManager();
        return () => (
          <button
            type="button"
            onClick={() =>
              add({
                title: 'title',
                actionProps: {
                  children: 'action',
                  onClick,
                },
              })
            }
          >
            add
          </button>
        );
      },
    });

    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
        <AddButton />
      </Toast.Provider>,
    );

    await user.click(screen.getByRole('button', { name: 'add' }));
    expect(onClick).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('action'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('forwards actionProps to the button', async () => {
    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>,
    );

    const button = screen.getByRole('button', { name: 'add' });

    await user.click(button);

    expect(screen.getByTestId('action').id).toBe('action');
  });

  it('does not render if it has no children', async () => {
    const AddButton = defineComponent({
      setup() {
        const { add } = Toast.useToastManager();
        return () => (
          <button
            type="button"
            onClick={() =>
              add({
                actionProps: {
                  children: undefined,
                },
              })
            }
          >
            add
          </button>
        );
      },
    });

    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
        <AddButton />
      </Toast.Provider>,
    );

    const button = screen.getByRole('button', { name: 'add' });
    await user.click(button);

    const actionElement = screen.queryByTestId('action');
    expect(actionElement).toBe(null);
  });

  it('does not render a childless render prop when there is no action content', async () => {
    await render(
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={toast}>
            <Toast.Action
              v-slots={{
                render: ({ props }: { props: HTMLProps }) => (
                  <button {...props} type="button" data-testid="action-render" />
                ),
              }}
            />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>,
    );

    expect(screen.queryByTestId('action-render')).toBe(null);
  });

  it('renders the toast action content through a childless render prop', async () => {
    await render(
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={{ id: 'test', actionProps: { children: 'Undo' } }}>
            <Toast.Action
              v-slots={{
                render: ({ props, children }: { props: HTMLProps; children: Component }) => (
                  <button {...props} type="button">
                    {h(children)}
                  </button>
                ),
              }}
            />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>,
    );

    expect(screen.getByText('Undo')).not.toBe(null);
  });

  it('gives the attributes and the listeners of actionProps to the button', async () => {
    const onClick = vi.fn();
    await render(
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root
            toast={{ id: 'test', actionProps: { id: 'action', children: 'Undo', onClick } }}
          >
            <Toast.Action data-testid="action" />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>,
    );

    const action = screen.getByTestId('action');
    expect(action.id).toBe('action');
    expect(action.textContent).toBe('Undo');

    await fireEvent.click(action);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows the content of actionProps in place of its default slot', async () => {
    await render(
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={{ id: 'test', actionProps: { children: () => h('strong', 'Undo') } }}>
            <Toast.Action data-testid="action">Retry</Toast.Action>
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>,
    );

    expect(screen.getByTestId('action').innerHTML).toBe('<strong>Undo</strong>');
  });

  it('renders its default slot when actionProps has no content', async () => {
    await render(
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={toast}>
            <Toast.Action data-testid="action">Retry</Toast.Action>
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>,
    );

    expect(screen.getByTestId('action').textContent).toBe('Retry');
  });
});
