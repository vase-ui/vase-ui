import { describe, expect, it, onTestFinished } from 'vitest';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  within,
} from '#test-utils';
import * as NavigationMenu from '../index.parts';
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
