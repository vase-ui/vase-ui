import { describe, expect, it } from 'vitest';
import { h } from 'vue';
import type { Component } from 'vue';
import {
  createRenderer,
  describeConformance,
  hydrate,
  renderOnServer,
  screen,
  within,
} from '#test-utils';
import type { HTMLProps } from '../../internals/types';
import * as Toast from '../index.parts';
import ToastTitleHydration from './ToastTitleHydration.test.vue';

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

  it('hydrates a toast with a component title in the toast and in the alert region, with no message', async () => {
    const serverHtml = await renderOnServer('src/toast/title/ToastTitleHydration.test.vue', {});
    const { container } = await hydrate(ToastTitleHydration, { serverHtml, props: {} });

    expect(container.querySelectorAll('[data-toast-label]')).toHaveLength(2);
    expect(within(container).getByTestId('title').innerHTML).toBe(
      '<em data-toast-label="">Saved</em>',
    );
    expect(within(container).getByTestId('description').textContent).toBe('The file is saved.');
    expect(within(container).getByTestId('action').innerHTML).toBe('<strong>Undo</strong>');
  });
});
