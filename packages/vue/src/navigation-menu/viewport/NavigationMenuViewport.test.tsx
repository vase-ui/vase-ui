import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, shallowRef } from 'vue';
import type { Ref } from 'vue';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
  waitForLaterMillisecond,
} from '#test-utils';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import { TOP_LEVEL_VIEWPORT_WARNING, allowTopLevelViewportWarning } from '../../../test/navigation-menuTestUtils';
import NavigationMenuViewportScoped from './NavigationMenuViewportScoped.test.vue';

type ViewportRenderSlotProps = Parameters<
  NonNullable<InstanceType<typeof NavigationMenu.Viewport>['$slots']['render']>
>[0];

describe('<NavigationMenu.Viewport />', () => {
  const { render } = createRenderer();

  describeConformance(<NavigationMenu.Viewport />, () => ({
    refInstanceof: window.HTMLDivElement,
    childrenSelector: 'div',
    render(node) {
      // Some cases of the suite count the calls of their own `console.warn` spy, so
      // `allowTopLevelViewportWarning()` cannot take the warning here. The inner root is nested, so
      // the viewport with no positioner gives no warning.
      return render(
        <NavigationMenu.Root>
          <NavigationMenu.Root>{node}</NavigationMenu.Root>
        </NavigationMenu.Root>,
      );
    },
  }));

  function renderMenu(
    viewportProps: Record<string, unknown> = {},
    triggerProps: NavigationMenu.Trigger.Props = {},
  ) {
    allowTopLevelViewportWarning();
    return render(
      <NavigationMenu.Root>
        <NavigationMenu.List>
          <NavigationMenu.Item value="one">
            <NavigationMenu.Trigger data-testid="trigger" {...triggerProps}>
              One
            </NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#first">First link</NavigationMenu.Link>
              <NavigationMenu.Link href="#second">Second link</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <NavigationMenu.Viewport data-testid="viewport" {...viewportProps} />
      </NavigationMenu.Root>,
    );
  }

  function getOwner(trigger: HTMLElement) {
    return trigger.parentElement!.querySelector('[aria-owns]');
  }

  function isFocusGuard(element: Element | null) {
    return element?.hasAttribute('data-vase-ui-focus-guard') ?? false;
  }

  function expectGuardsBeside(element: HTMLElement) {
    expect([element.previousElementSibling, element.nextElementSibling].map(isFocusGuard)).toEqual([
      true,
      true,
    ]);
  }

  async function openMenu() {
    await fireEvent.click(screen.getByTestId('trigger'));
    await flushMicrotasks();
  }

  it('has an id that the owner element of the active trigger names', async () => {
    await renderMenu();
    const trigger = screen.getByTestId('trigger');
    const viewport = screen.getByTestId('viewport');
    expect(viewport.id).not.toBe('');

    await fireEvent.click(trigger);

    expect(getOwner(trigger)).toHaveAttribute('aria-owns', viewport.id);
  });

  it('takes the id of its prop', async () => {
    await renderMenu({ id: 'menu-viewport' });
    const trigger = screen.getByTestId('trigger');

    await fireEvent.click(trigger);

    expect(screen.getByTestId('viewport')).toHaveAttribute('id', 'menu-viewport');
    expect(getOwner(trigger)).toHaveAttribute('aria-owns', 'menu-viewport');
  });

  it('renders the focus guards around its content only while an item is active', async () => {
    await renderMenu();
    const viewport = screen.getByTestId('viewport');
    const target = viewport.firstElementChild!;
    expect(viewport.querySelectorAll('[data-vase-ui-focus-guard]')).toHaveLength(0);

    await fireEvent.click(screen.getByTestId('trigger'));

    const [before, middle, after] = Array.from(viewport.children);
    expect(viewport.children).toHaveLength(3);
    expect(before).toHaveAttribute('data-vase-ui-focus-guard');
    expect(middle).toBe(target);
    expect(after).toHaveAttribute('data-vase-ui-focus-guard');
    expect(target).toContainElement(screen.getByRole('link', { name: 'First link' }));
  });

  it('sends the focus from the guard before the content to the first link', async () => {
    await renderMenu();
    await waitForLaterMillisecond(() => fireEvent.click(screen.getByTestId('trigger')));
    const guard = screen.getByTestId('viewport').firstElementChild as HTMLElement;

    guard.focus();
    await flushMicrotasks();

    expect(screen.getByRole('link', { name: 'First link' })).toHaveFocus();
  });

  it('does not become inert when the focus goes from its content to the active trigger', async () => {
    // The trigger also makes the viewport interactive when it gets the focus. The listener of the
    // consumer stops that handler, so that only the viewport decides.
    await renderMenu({}, { onFocusin: (event) => event.preventVaseUIHandler() });
    const trigger = screen.getByTestId('trigger');
    const viewport = screen.getByTestId('viewport');
    await waitForLaterMillisecond(() => fireEvent.click(trigger));
    screen.getByRole('link', { name: 'First link' }).focus();
    expect(viewport).not.toHaveAttribute('inert');

    trigger.focus();
    await flushMicrotasks();

    expect(trigger).toHaveFocus();
    expect(viewport).not.toHaveAttribute('inert');
  });

  describe('in a positioner', () => {
    it('holds the content itself, with a focus guard before and after its element', async () => {
      await render(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item value="one">
              <NavigationMenu.Trigger data-testid="trigger">One</NavigationMenu.Trigger>
              <NavigationMenu.Content data-testid="content">
                <NavigationMenu.Link href="#first">First link</NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner>
              <NavigationMenu.Popup data-testid="popup">
                <NavigationMenu.Viewport data-testid="viewport" />
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>,
      );

      await fireEvent.click(screen.getByTestId('trigger'));
      await flushMicrotasks();

      const viewport = screen.getByTestId('viewport');
      const [before, middle, after] = Array.from(screen.getByTestId('popup').children);
      expect(before).toHaveAttribute('data-vase-ui-focus-guard');
      expect(middle).toBe(viewport);
      expect(after).toHaveAttribute('data-vase-ui-focus-guard');
      expect(screen.getByTestId('content').parentElement).toBe(viewport);
    });

    it.each([
      {
        name: 'it unmounts',
        renderViewport: (shown: Readonly<Ref<boolean>>) =>
          shown.value ? <NavigationMenu.Viewport data-testid="viewport" /> : null,
      },
      {
        name: 'its render slot drops its element',
        renderViewport: (shown: Readonly<Ref<boolean>>) => (
          <NavigationMenu.Viewport
            v-slots={{
              render: ({ props, children }: ViewportRenderSlotProps) =>
                shown.value ? (
                  <div {...props} data-testid="viewport">
                    {h(children)}
                  </div>
                ) : null,
            }}
          />
        ),
      },
    ])('gives its guards to the root, and clears them when $name', async ({ renderViewport }) => {
      let rootContext!: ReturnType<typeof useNavigationMenuRootContext>;
      const RootContextReader = defineComponent(() => {
        rootContext = useNavigationMenuRootContext();
        return () => null;
      });
      const shown = shallowRef(true);
      await render(() => (
        <NavigationMenu.Root>
          <RootContextReader />
          <NavigationMenu.List>
            <NavigationMenu.Item value="one">
              <NavigationMenu.Trigger data-testid="trigger">One</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="#first">First link</NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner>
              <NavigationMenu.Popup data-testid="popup">
                {renderViewport(shown)}
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>
      ));
      await openMenu();
      const viewport = screen.getByTestId('viewport');
      expectGuardsBeside(viewport);
      expect(rootContext.beforeInsideRef.value).toBe(viewport.previousElementSibling);
      expect(rootContext.afterInsideRef.value).toBe(viewport.nextElementSibling);

      shown.value = false;
      await flushMicrotasks();

      expect(rootContext.beforeInsideRef.value).toBe(null);
      expect(rootContext.afterInsideRef.value).toBe(null);
      expect(
        screen.getByTestId('popup').querySelectorAll('[data-vase-ui-focus-guard]'),
      ).toHaveLength(0);
    });
  });

  describe('VUE-60: the viewport in a positioner has one root node', () => {
    it('gives the scope id of the consumer to its element', async () => {
      await render(<NavigationMenuViewportScoped mode="scoped" />);
      await openMenu();
      const viewport = screen.getByTestId('viewport');

      expect(getComputedStyle(viewport).outlineStyle).toBe('dashed');
      expectGuardsBeside(viewport);
    });

    it('gives a custom directive of the consumer to its element', async () => {
      await render(<NavigationMenuViewportScoped mode="directive" />);
      await openMenu();
      const viewport = screen.getByTestId('viewport');

      expect(viewport).toHaveAttribute('data-mark', 'marked');
      expectGuardsBeside(viewport);
    });

    it('hides its element with v-show', async () => {
      const shown = shallowRef(true);
      await render(() => <NavigationMenuViewportScoped mode="show" shown={shown.value} />);
      await openMenu();
      // An ancestor can have `opacity: 0` until the first position, so the case reads the display
      // of the element itself.
      const viewport = screen.getByTestId('viewport');
      expect(getComputedStyle(viewport).display).toBe('block');

      shown.value = false;
      await nextTick();

      expect(getComputedStyle(viewport).display).toBe('none');
      expectGuardsBeside(viewport);
    });

    it('renders in a Transition', async () => {
      // The test setup fails the case on the warning that Vue gives for a part with more than one
      // root node in a `Transition`.
      await render(<NavigationMenuViewportScoped mode="transition" />);
      await openMenu();

      expectGuardsBeside(screen.getByTestId('viewport'));
    });
  });

  describe('VUE-104: a development build warns about a viewport with no positioner in a top-level root', () => {
    function spyOnWarnings() {
      return vi.spyOn(console, 'warn').mockImplementation(() => {});
    }

    it('warns one time when the viewport mounts, and not again when it mounts again', async () => {
      const warn = spyOnWarnings();
      const shown = shallowRef(true);

      await render(() => (
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item value="one">
              <NavigationMenu.Trigger>One</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="#first">First link</NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          {shown.value ? <NavigationMenu.Viewport data-testid="viewport" /> : null}
        </NavigationMenu.Root>
      ));

      expect(warn.mock.calls).toEqual([[TOP_LEVEL_VIEWPORT_WARNING]]);

      shown.value = false;
      await nextTick();
      expect(screen.queryByTestId('viewport')).toBe(null);
      shown.value = true;
      await nextTick();

      expect(screen.getByTestId('viewport')).toBeInTheDocument();
      expect(warn.mock.calls).toEqual([[TOP_LEVEL_VIEWPORT_WARNING]]);
    });

    it('gives no warning for a viewport with no positioner in a nested root', async () => {
      const warn = spyOnWarnings();

      await render(
        <NavigationMenu.Root defaultValue="outer">
          <NavigationMenu.List>
            <NavigationMenu.Item value="outer">
              <NavigationMenu.Trigger>Outer</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Root defaultValue="inner">
                  <NavigationMenu.List>
                    <NavigationMenu.Item value="inner">
                      <NavigationMenu.Trigger>Inner</NavigationMenu.Trigger>
                      <NavigationMenu.Content>
                        <NavigationMenu.Link href="#inner">Inner link</NavigationMenu.Link>
                      </NavigationMenu.Content>
                    </NavigationMenu.Item>
                  </NavigationMenu.List>
                  <NavigationMenu.Viewport data-testid="nested-viewport" />
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
      await flushMicrotasks();

      expect(screen.getByTestId('nested-viewport')).toContainElement(
        screen.getByRole('link', { name: 'Inner link' }),
      );
      expect(warn).not.toHaveBeenCalled();
    });

    it('gives no warning for a viewport in a positioner of a top-level root', async () => {
      const warn = spyOnWarnings();

      await render(
        <NavigationMenu.Root defaultValue="one">
          <NavigationMenu.List>
            <NavigationMenu.Item value="one">
              <NavigationMenu.Trigger>One</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="#first">First link</NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner>
              <NavigationMenu.Popup>
                <NavigationMenu.Viewport data-testid="viewport" />
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>,
      );
      await flushMicrotasks();

      expect(screen.getByTestId('viewport')).toContainElement(
        screen.getByRole('link', { name: 'First link' }),
      );
      expect(warn).not.toHaveBeenCalled();
    });
  });
});
