import { describe, expect, it, vi } from 'vitest';
import { h } from 'vue';
import type { Component } from 'vue';
import { createRenderer, describeConformance, fireEvent, screen } from '#test-utils';
import type { HTMLProps } from '../../internals/types';
import * as Toast from '../index.parts';

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
