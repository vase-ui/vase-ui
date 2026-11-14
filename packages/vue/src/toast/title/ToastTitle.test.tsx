import { describe, expect, it } from 'vitest';
import { h } from 'vue';
import type { Component } from 'vue';
import { createRenderer, describeConformance, screen } from '#test-utils';
import type { HTMLProps } from '../../internals/types';
import * as Toast from '../index.parts';

const toast = {
  id: 'test',
  title: 'Toast title',
};

describe('<Toast.Title />', () => {
  const { render } = createRenderer();

  describeConformance(<Toast.Title>title</Toast.Title>, () => ({
    refInstanceof: window.HTMLHeadingElement,
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

  it('renders the title of the toast in the children component of the #render slot', async () => {
    await render(
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={toast}>
            <Toast.Title
              data-testid="title"
              v-slots={{
                render: ({ props, children }: { props: HTMLProps; children: Component }) => (
                  <strong {...props}>{h(children)}</strong>
                ),
              }}
            />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>,
    );

    const title = screen.getByTestId('title');
    expect(title.localName).toBe('strong');
    expect(title.textContent).toBe('Toast title');
  });
});
