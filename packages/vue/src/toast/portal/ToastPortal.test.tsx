import { describe, expect, it } from 'vitest';
import { h } from 'vue';
import type { Component } from 'vue';
import { createRenderer, describeConformance, screen } from '#test-utils';
import * as Toast from '../index.parts';

type RenderSlotProps = { props: Record<string, unknown>; children: Component };

describe('<Toast.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(<Toast.Portal />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(node);
    },
  }));

  it('renders its children in a portal element of the body', async () => {
    await render(
      <Toast.Provider>
        <Toast.Portal data-testid="portal">
          <Toast.Viewport data-testid="viewport" />
        </Toast.Portal>
      </Toast.Provider>,
    );

    expect(screen.getByTestId('portal').parentElement).toBe(document.body);
    expect(screen.getByTestId('portal')).toContainElement(screen.getByTestId('viewport'));
  });

  it('puts the content of children in the element of the #render slot', async () => {
    await render(
      <Toast.Provider>
        <Toast.Portal
          v-slots={{
            render: ({ props, children }: RenderSlotProps) => (
              <section {...props} data-testid="portal">
                {h(children, null, () => (
                  <Toast.Viewport data-testid="viewport" />
                ))}
              </section>
            ),
          }}
        />
      </Toast.Provider>,
    );

    expect(screen.getByTestId('portal')).toContainElement(screen.getByTestId('viewport'));
  });
});
