import { describe, expect, it } from 'vitest';
import { h } from 'vue';
import type { Component } from 'vue';
import { createRenderer, describeConformance, screen } from '#test-utils';
import type { HTMLProps } from '../../internals/types';
import * as Combobox from '../index.parts';

describe('<Combobox.Icon />', () => {
  const { render } = createRenderer();

  describeConformance(<Combobox.Icon />, () => ({
    refInstanceof: window.HTMLSpanElement,
    render(node) {
      return render(<Combobox.Root open>{node}</Combobox.Root>);
    },
  }));

  it('shows the down arrow in the children component of the #render slot', async () => {
    await render(
      <Combobox.Root>
        <Combobox.Icon
          data-testid="icon"
          v-slots={{
            render: ({ props, children }: { props: HTMLProps; children: Component }) => (
              <i {...props}>{h(children)}</i>
            ),
          }}
        />
      </Combobox.Root>,
    );

    const icon = screen.getByTestId('icon');
    expect(icon.localName).toBe('i');
    expect(icon.textContent).toBe('▼');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});
