import { describe, expect, it, onTestFinished } from 'vitest';
import { shallowRef } from 'vue';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import {
  createRenderer,
  describeConformance,
  expectNoAxeViolations,
  fireEvent,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  waitFor,
  waitForLaterMillisecond,
  within,
} from '#test-utils';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import NavigationMenuPopupHydration from './NavigationMenuPopupHydration.test.vue';

const HYDRATION_FIXTURE = 'src/navigation-menu/popup/NavigationMenuPopupHydration.test.vue';

describe('<NavigationMenu.Popup />', () => {
  const { render } = createRenderer();

  // The portal renders the popup in the flush after the mount.
  describeConformance(<NavigationMenu.Popup />, () => ({
    refInstanceof: window.HTMLElement,
    async render(node) {
      const result = await render(
        <NavigationMenu.Root value="test">
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner>{node}</NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  function renderMenu(
    popupProps: Record<string, unknown> = {},
    positionerProps: Record<string, unknown> = {},
    direction: 'ltr' | 'rtl' = 'ltr',
  ) {
    return render(
      <DirectionProvider direction={direction}>
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item value="one">
              <NavigationMenu.Trigger data-testid="trigger">One</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="#one">Link of one</NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner {...positionerProps}>
              <NavigationMenu.Popup data-testid="popup" {...popupProps}>
                <NavigationMenu.Viewport />
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>
      </DirectionProvider>,
    );
  }

  async function open() {
    await fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();
    return screen.getByTestId('popup');
  }

  it('has an id that the active trigger names in aria-controls', async () => {
    await renderMenu();
    const popup = await open();

    expect(popup.id).not.toBe('');
    expect(screen.getByTestId('trigger')).toHaveAttribute('aria-controls', popup.id);
  });

  it('takes the id of its prop', async () => {
    await renderMenu({ id: 'menu-popup' });
    await open();

    expect(screen.getByTestId('trigger')).toHaveAttribute('aria-controls', 'menu-popup');
  });

  it('has tabindex="-1" and the state attributes of the open popup', async () => {
    await renderMenu();
    const popup = await open();

    expect(popup).toHaveAttribute('tabindex', '-1');
    expect(popup).toHaveAttribute('data-open');
    expect(popup).toHaveAttribute('data-side', 'bottom');
    expect(popup).toHaveAttribute('data-align', 'center');
  });

  it.each([
    { name: 'bottom', side: 'bottom', direction: 'ltr', style: undefined },
    {
      name: 'top',
      side: 'top',
      direction: 'ltr',
      style: { position: 'absolute', bottom: '0px', left: '0px' },
    },
    {
      name: 'left',
      side: 'left',
      direction: 'ltr',
      style: { position: 'absolute', top: '0px', right: '0px' },
    },
    {
      name: 'inline-start',
      side: 'inline-start',
      direction: 'ltr',
      style: { position: 'absolute', top: '0px', right: '0px' },
    },
    {
      name: 'inline-end in RTL',
      side: 'inline-end',
      direction: 'rtl',
      style: { position: 'absolute', top: '0px', right: '0px' },
    },
  ] as const)(
    'anchors its size transition at the side of the trigger: $name',
    async ({ side, direction, style }) => {
      await renderMenu({}, { side, collisionAvoidance: { side: 'none' } }, direction);
      const popup = await open();

      if (style) {
        expect(popup).toHaveStyle(style);
      } else {
        expect(popup.style.position).toBe('');
      }
    },
  );

  it('has no transition while it starts to open', async () => {
    await renderMenu();
    const transitions: string[] = [];
    // The popup has `data-starting-style` only until the next frame. The observer records the
    // style of the popup in the update that adds it.
    const observer = new MutationObserver(() => {
      const popup = screen.queryByTestId('popup');
      if (popup?.hasAttribute('data-starting-style')) {
        transitions.push(popup.style.transition);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    onTestFinished(() => observer.disconnect());

    await open();

    expect(transitions[0]).toBe('none');
  });

  describe('VUE-105: the name of the popup', () => {
    function renderNamedMenu(
      options: {
        rootProps?: Record<string, unknown>;
        triggerProps?: Record<string, unknown>;
        popupProps?: Record<string, unknown>;
      } = {},
    ) {
      // The fixture is a function, so that Vue makes the `ref` of the root in a render.
      return render(() => (
        <NavigationMenu.Root {...options.rootProps}>
          <NavigationMenu.List>
            <NavigationMenu.Item value="one">
              <NavigationMenu.Trigger data-testid="trigger-one" {...options.triggerProps}>
                One
              </NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="#one">Link of one</NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
            <NavigationMenu.Item value="two">
              <NavigationMenu.Trigger data-testid="trigger-two">Two</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="#two">Link of two</NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner>
              <NavigationMenu.Popup data-testid="popup" {...options.popupProps}>
                <NavigationMenu.Viewport />
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>
      ));
    }

    async function openOne() {
      await fireEvent.click(screen.getByTestId('trigger-one'));
      await flushMicrotasks();
      return screen.getByTestId('popup');
    }

    it('has the name of its trigger', async () => {
      await renderNamedMenu();
      const trigger = screen.getByTestId('trigger-one');
      const popup = await openOne();

      expect(screen.getByRole('navigation', { name: 'One' })).toBe(popup);
      expect(trigger.id).not.toBe('');
      expect(popup).toHaveAttribute('aria-labelledby', trigger.id);
    });

    it('takes the name of the trigger that becomes active', async () => {
      await renderNamedMenu();
      const two = screen.getByTestId('trigger-two');
      const popup = await openOne();

      await fireEvent.click(two);
      await flushMicrotasks();

      expect(two).toHaveAttribute('aria-expanded', 'true');
      expect(popup).toHaveAttribute('aria-labelledby', two.id);
      expect(screen.getByRole('navigation', { name: 'Two' })).toBe(popup);
    });

    it('takes the id that the consumer gives the trigger', async () => {
      await renderNamedMenu({ triggerProps: { id: 'products-trigger' } });
      const popup = await openOne();

      expect(screen.getByTestId('trigger-one')).toHaveAttribute('id', 'products-trigger');
      expect(popup).toHaveAttribute('aria-labelledby', 'products-trigger');
    });

    it('uses an aria-label instead of the trigger label', async () => {
      await renderNamedMenu({ popupProps: { 'aria-label': 'Site sections' } });
      const popup = await openOne();

      expect(screen.getByRole('navigation', { name: 'Site sections' })).toBe(popup);
      expect(popup).not.toHaveAttribute('aria-labelledby');
    });

    it('keeps the name of its trigger until it unmounts', async () => {
      const actionsRef = shallowRef<NavigationMenu.Root.Actions | null>(null);
      await renderNamedMenu({
        rootProps: {
          ref: actionsRef,
          onValueChange: (value: unknown, details: NavigationMenu.Root.ChangeEventDetails) => {
            if (value == null) {
              details.preventUnmountOnClose();
            }
          },
        },
      });
      const trigger = screen.getByTestId('trigger-one');
      const popup = await openOne();

      actionsRef.value?.close();
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(popup).toBeInTheDocument();
      expect(popup).toHaveAttribute('aria-labelledby', trigger.id);

      actionsRef.value?.unmount();
      await waitFor(() => {
        expect(popup).not.toBeInTheDocument();
      });
    });

    it('gives each open popup of a nested menu a name of its own', async () => {
      await render(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item value="products">
              <NavigationMenu.Trigger data-testid="trigger-products">
                Products
              </NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Root>
                  <NavigationMenu.List>
                    <NavigationMenu.Item value="guides">
                      <NavigationMenu.Trigger data-testid="trigger-guides">
                        Guides
                      </NavigationMenu.Trigger>
                      <NavigationMenu.Content>
                        <NavigationMenu.Link href="#guides">Link of guides</NavigationMenu.Link>
                      </NavigationMenu.Content>
                    </NavigationMenu.Item>
                  </NavigationMenu.List>
                  <NavigationMenu.Portal>
                    <NavigationMenu.Positioner side="right">
                      <NavigationMenu.Popup>
                        <NavigationMenu.Viewport />
                      </NavigationMenu.Popup>
                    </NavigationMenu.Positioner>
                  </NavigationMenu.Portal>
                </NavigationMenu.Root>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner>
              <NavigationMenu.Popup>
                <NavigationMenu.Viewport />
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>,
      );

      await waitForLaterMillisecond(() => fireEvent.click(screen.getByTestId('trigger-products')));
      await fireEvent.click(screen.getByTestId('trigger-guides'));
      await flushMicrotasks();

      expect(screen.getByTestId('trigger-guides')).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('navigation', { name: 'Products' })).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: 'Guides' })).toBeInTheDocument();
      await expectNoAxeViolations(document.body, { runOnly: ['landmark-unique'] });
    });
  });

  describe('hydration', () => {
    it.each([
      { name: 'a closed menu', props: {}, open: false },
      { name: 'a closed menu with a kept portal', props: { keepMounted: true }, open: false },
      { name: 'an open menu', props: { defaultValue: 'one' }, open: true },
    ])('hydrates $name, with no popup in the server HTML', async ({ props, open }) => {
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);
      expect(serverHtml).not.toContain('data-testid="popup"');

      const { container } = await hydrate(NavigationMenuPopupHydration, { serverHtml, props });

      expect(within(container).getByTestId('trigger-one')).toHaveAttribute(
        'aria-expanded',
        String(open),
      );
      expect(within(container).getByTestId('backdrop').hasAttribute('hidden')).toBe(!open);
    });
  });
});
