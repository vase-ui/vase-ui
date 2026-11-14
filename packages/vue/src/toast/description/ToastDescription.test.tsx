import { describe, expect, it } from 'vitest';
import { h } from 'vue';
import type { Component } from 'vue';
import { createRenderer, describeConformance, screen } from '#test-utils';
import type { HTMLProps } from '../../internals/types';
import * as Toast from '../index.parts';

const toast: Toast.Root.ToastObject = {
  id: 'test',
  title: 'Toast title',
};

describe('<Toast.Description />', () => {
  const { render } = createRenderer();

  describeConformance(<Toast.Description>description</Toast.Description>, () => ({
    refInstanceof: window.HTMLParagraphElement,
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

  it('renders the description of the toast in the children component of the #render slot', async () => {
    await render(
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root toast={{ id: 'test', description: 'Toast description' }}>
            <Toast.Description
              data-testid="description"
              v-slots={{
                render: ({ props, children }: { props: HTMLProps; children: Component }) => (
                  <em {...props}>{h(children)}</em>
                ),
              }}
            />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>,
    );

    const description = screen.getByTestId('description');
    expect(description.localName).toBe('em');
    expect(description.textContent).toBe('Toast description');
  });
});
