import { describe, expect, it } from 'vitest';
import { h } from 'vue';
import type { Component } from 'vue';
import * as Select from '../index.parts';
import { createRenderer, describeConformance, flushMicrotasks, screen } from '#test-utils';

describe('<Select.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.Portal />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(<Select.Root open>{node}</Select.Root>);
      await flushMicrotasks();
      return result;
    },
  }));

  it('renders the popup in the children component of the #render slot', async () => {
    await render(
      <Select.Root open>
        <Select.Trigger />
        <Select.Portal
          v-slots={{
            render: ({
              props,
              children,
            }: {
              props: Record<string, unknown>;
              children: Component;
            }) => (
              <section {...props} data-testid="portal">
                {h(children, null, () => (
                  <Select.Positioner>
                    <Select.Popup>
                      <Select.Item value="a">a</Select.Item>
                    </Select.Popup>
                  </Select.Positioner>
                ))}
              </section>
            ),
          }}
        />
      </Select.Root>,
    );
    await flushMicrotasks();

    const portal = screen.getByTestId('portal');
    expect(portal.localName).toBe('section');
    expect(portal.parentElement).toBe(document.body);
    expect(portal.contains(screen.getByRole('option', { name: 'a' }))).toBe(true);
  });
});
