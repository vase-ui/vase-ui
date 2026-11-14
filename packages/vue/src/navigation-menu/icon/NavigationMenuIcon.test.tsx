import { vi, describe, it, expect } from 'vitest';
import { h } from 'vue';
import type { Component } from 'vue';
import type { HTMLProps } from '@vase-ui/vue/types';
import { createRenderer, describeConformance, screen, takeReportedMessages } from '#test-utils';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';

describe('<NavigationMenu.Icon />', () => {
  const { render } = createRenderer();

  describeConformance(<NavigationMenu.Icon />, () => ({
    refInstanceof: window.HTMLSpanElement,
    render(node) {
      return render(
        <NavigationMenu.Root>
          <NavigationMenu.Item>{node}</NavigationMenu.Item>
        </NavigationMenu.Root>,
      );
    },
  }));

  it('shows a down arrow and hides it from assistive technology', async () => {
    await render(
      <NavigationMenu.Root>
        <NavigationMenu.Item>
          <NavigationMenu.Icon data-testid="icon" />
        </NavigationMenu.Item>
      </NavigationMenu.Root>,
    );

    const icon = screen.getByTestId('icon');
    expect(icon.textContent).toBe('▼');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows the default slot in place of the down arrow', async () => {
    await render(
      <NavigationMenu.Root>
        <NavigationMenu.Item>
          <NavigationMenu.Icon data-testid="icon" v-slots={{ default: () => 'open' }} />
        </NavigationMenu.Item>
      </NavigationMenu.Root>,
    );

    expect(screen.getByTestId('icon').textContent).toBe('open');
  });

  it('shows the down arrow in the children component of the #render slot', async () => {
    await render(
      <NavigationMenu.Root>
        <NavigationMenu.Item>
          <NavigationMenu.Icon
            data-testid="icon"
            v-slots={{
              render: ({ props, children }: { props: HTMLProps; children: Component }) => (
                <i {...props}>{h(children)}</i>
              ),
            }}
          />
        </NavigationMenu.Item>
      </NavigationMenu.Root>,
    );

    const icon = screen.getByTestId('icon');
    expect(icon.localName).toBe('i');
    expect(icon.textContent).toBe('▼');
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  it('throws a descriptive error when rendered outside <NavigationMenu.Item>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(
        render(
          <NavigationMenu.Root>
            <NavigationMenu.Icon />
          </NavigationMenu.Root>,
        ),
      ).rejects.toThrow(
        'Vase UI: <NavigationMenu.Item> is missing. A trigger, a content and an icon read the value of their item. Put the part inside <NavigationMenu.Item>.',
      );
    } finally {
      errorSpy.mockRestore();
    }

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
