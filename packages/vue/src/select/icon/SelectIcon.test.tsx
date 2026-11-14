import { describe, expect, it } from 'vitest';
import { h } from 'vue';
import type { Component } from 'vue';
import { createRenderer, describeConformance, screen } from '#test-utils';
import type { HTMLProps } from '../../internals/types';
import * as Select from '../index.parts';

describe('<Select.Icon />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.Icon />, () => ({
    refInstanceof: window.HTMLSpanElement,
    render(node) {
      return render(<Select.Root open>{node}</Select.Root>);
    },
  }));

  it('shows a down arrow and hides it from assistive technology', async () => {
    await render(
      <Select.Root>
        <Select.Icon data-testid="icon" />
      </Select.Root>,
    );

    const icon = screen.getByTestId('icon');
    expect(icon.textContent).toBe('▼');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows the default slot in place of the down arrow', async () => {
    await render(
      <Select.Root>
        <Select.Icon data-testid="icon" v-slots={{ default: () => 'open' }} />
      </Select.Root>,
    );

    expect(screen.getByTestId('icon').textContent).toBe('open');
  });

  it('shows the down arrow in the children component of the #render slot', async () => {
    await render(
      <Select.Root>
        <Select.Icon
          data-testid="icon"
          v-slots={{
            render: ({ props, children }: { props: HTMLProps; children: Component }) => (
              <i {...props}>{h(children)}</i>
            ),
          }}
        />
      </Select.Root>,
    );

    const icon = screen.getByTestId('icon');
    expect(icon.localName).toBe('i');
    expect(icon.textContent).toBe('▼');
  });
});
