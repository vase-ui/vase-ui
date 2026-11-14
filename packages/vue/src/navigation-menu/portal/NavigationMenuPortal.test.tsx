import { describe, expect, it } from 'vitest';
import { defineComponent, h, KeepAlive, shallowRef } from 'vue';
import { createRenderer, describeConformance, flushMicrotasks, screen } from '#test-utils';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';

type RenderSlotProps = Parameters<
  NonNullable<InstanceType<typeof NavigationMenu.Portal>['$slots']['render']>
>[0];

describe('<NavigationMenu.Portal />', () => {
  const { render } = createRenderer();

  // The portal renders its element in the flush after the mount.
  describeConformance(<NavigationMenu.Portal />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(<NavigationMenu.Root value="item">{node}</NavigationMenu.Root>);
      await flushMicrotasks();
      return result;
    },
  }));

  function renderMenu(portalProps: Record<string, unknown> = {}) {
    return render(
      <NavigationMenu.Root>
        <NavigationMenu.List>
          <NavigationMenu.Item value="one">
            <NavigationMenu.Trigger>One</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#one">Link of one</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <NavigationMenu.Portal data-testid="portal" {...portalProps}>
          <NavigationMenu.Positioner data-testid="positioner">
            <NavigationMenu.Popup>
              <NavigationMenu.Viewport />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>,
    );
  }

  describe('slot: render', () => {
    it('puts the content of children in the element of the slot', async () => {
      await render(
        <NavigationMenu.Root defaultValue="one">
          <NavigationMenu.List>
            <NavigationMenu.Item value="one">
              <NavigationMenu.Trigger>One</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="#one">Link of one</NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal
            v-slots={{
              render: ({ props, children }: RenderSlotProps) => (
                <section {...props} data-testid="portal">
                  {h(children, null, () => (
                    <NavigationMenu.Positioner>
                      <NavigationMenu.Popup data-testid="popup">
                        <NavigationMenu.Viewport />
                      </NavigationMenu.Popup>
                    </NavigationMenu.Positioner>
                  ))}
                </section>
              ),
            }}
          />
        </NavigationMenu.Root>,
      );
      await flushMicrotasks();

      expect(screen.getByTestId('portal')).toContainElement(screen.getByTestId('popup'));
      expect(screen.getByTestId('popup')).toContainElement(screen.getByText('Link of one'));
    });
  });

  it('renders nothing while the menu is closed', async () => {
    await renderMenu();
    await flushMicrotasks();

    expect(screen.queryByTestId('portal')).toBe(null);
  });

  it('keeps the closed popup hidden in the DOM with keepMounted', async () => {
    await renderMenu({ keepMounted: true });
    await flushMicrotasks();

    expect(screen.getByTestId('positioner')).toHaveAttribute('hidden');
  });

  it('takes the popup out of the document while KeepAlive holds the menu, and puts the same element back', async () => {
    const visible = shallowRef(true);
    // `KeepAlive` caches only a stateful component.
    const Menu = defineComponent(() => () => (
      <NavigationMenu.Root defaultValue="one">
        <NavigationMenu.List>
          <NavigationMenu.Item value="one">
            <NavigationMenu.Trigger>One</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#one">Link of one</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner>
            <NavigationMenu.Popup data-testid="popup">
              <NavigationMenu.Viewport />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>
    ));
    await render(() => <KeepAlive>{visible.value ? <Menu /> : null}</KeepAlive>);
    await flushMicrotasks();
    const popup = screen.getByTestId('popup');

    visible.value = false;
    await flushMicrotasks();
    expect(popup.isConnected).toBe(false);

    visible.value = true;
    await flushMicrotasks();
    expect(screen.getByTestId('popup')).toBe(popup);
    expect(popup).toHaveAttribute('data-open');
  });
});
