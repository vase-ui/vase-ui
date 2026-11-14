import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { computed, defineComponent, h, shallowRef } from 'vue';
import type { Component } from 'vue';
import * as Menu from '../index.parts';
import { createRenderer, describeConformance, flushMicrotasks, screen } from '#test-utils';
import {
  ContextMenuProvider,
  MenubarProvider,
  createContextMenuContext,
  createMenubarContext,
} from '../../../test/fixtures/MenuParentFixture';
import FocusManagerPart from '../../../test/fixtures/FocusManagerPart.vue';
import { createMenuStoreProbe } from '../../../test/fixtures/MenuStoreProbe';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { createAttribute } from '../../utils/popups/createAttribute';

const INTERNAL_BACKDROP_SELECTOR = `[${createAttribute('inert')}]`;

type RenderSlotProps = { props: Record<string, unknown>; children: Component };

// The owner element is the `span` that is not a focus guard.
function getOwner(host: HTMLElement) {
  return Array.from(host.children).find(
    (child) => child.localName === 'span' && !child.hasAttribute(createAttribute('focus-guard')),
  );
}

describe('<Menu.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(<Menu.Portal keepMounted />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Menu.Root>{node}</Menu.Root>);
    },
  }));

  describe('slot: render', () => {
    it('puts the content of children in the element of the slot', async () => {
      await render(
        <Menu.Root open>
          <Menu.Portal
            v-slots={{
              render: ({ props, children }: RenderSlotProps) => (
                <section {...props} data-testid="portal">
                  {h(children, null, () => (
                    <Menu.Positioner>
                      <Menu.Popup data-testid="popup">Content</Menu.Popup>
                    </Menu.Positioner>
                  ))}
                </section>
              ),
            }}
          />
        </Menu.Root>,
      );

      expect(screen.getByTestId('portal')).toContainElement(screen.getByTestId('popup'));
    });
  });

  describe('prop: container', () => {
    it('keeps a closed menu inside an ancestor ref when opening', async () => {
      const Test = defineComponent({
        props: { open: { type: Boolean, required: true } },
        setup(props) {
          const container = shallowRef<HTMLElement | null>(null);
          const setContainer = (element: unknown) => {
            container.value = element as HTMLElement | null;
          };

          return () => (
            <div ref={setContainer} data-testid="container">
              <Menu.Root open={props.open}>
                <Menu.Trigger>Open menu</Menu.Trigger>
                <Menu.Portal container={container} keepMounted>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="popup">
                      <Menu.Item>Item</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </div>
          );
        },
      });

      const { setProps } = await render(() => <Test open={false} />);
      const container = screen.getByTestId('container');
      const popup = screen.getByTestId('popup');
      expect(screen.queryByRole('menu')).toBeNull();
      expect(container).toContainElement(popup);

      await setProps({ open: true });

      expect(screen.getByRole('menu')).toBe(popup);
      expect(container).toContainElement(popup);
    });
  });

  describe('rendering', () => {
    it.each([
      { name: 'a closed menu', open: false, keepMounted: false, rendered: false },
      {
        name: 'a closed menu that is kept mounted',
        open: false,
        keepMounted: true,
        rendered: true,
      },
      { name: 'an open menu', open: true, keepMounted: false, rendered: true },
    ])('renders the portal element for $name only when it is mounted', async (testCase) => {
      await render(
        <Menu.Root open={testCase.open}>
          <Menu.Portal data-testid="portal" keepMounted={testCase.keepMounted} />
        </Menu.Root>,
      );

      expect(screen.queryByTestId('portal') !== null).toBe(testCase.rendered);
    });

    it.each([
      { name: 'a menubar', inMenubar: true, role: 'group' },
      { name: 'no parent', inMenubar: false, role: null },
    ])('gives the owner element of a menu in $name its role', async ({ inMenubar, role }) => {
      const menu = (
        <Menu.Root open>
          <Menu.Portal>
            <FocusManagerPart />
          </Menu.Portal>
        </Menu.Root>
      );

      await render(
        <div data-testid="host">
          {inMenubar ? (
            <MenubarProvider context={createMenubarContext()}>{menu}</MenubarProvider>
          ) : (
            menu
          )}
        </div>,
      );

      const owner = getOwner(screen.getByTestId('host'));
      expect(owner).toBeDefined();
      expect(owner!.getAttribute('role')).toBe(role);
    });
  });

  describe('internal backdrop', () => {
    function getBackdrop() {
      return screen.getByTestId('portal').querySelector<HTMLElement>(INTERNAL_BACKDROP_SELECTOR);
    }

    // An element of the page at a known place, for the hole in the backdrop.
    function addElement(cssText: string) {
      const element = document.createElement('div');
      element.style.cssText = cssText;
      document.body.append(element);
      onTestFinished(() => element.remove());
      return element;
    }

    it.each([
      { name: 'modal true', modal: true, hasBackdrop: true },
      { name: 'modal false', modal: false, hasBackdrop: false },
    ])(
      'renders it before the positioner, only for a modal menu: $name',
      async ({ modal, hasBackdrop }) => {
        await render(
          <Menu.Root defaultOpen modal={modal}>
            <Menu.Portal data-testid="portal">
              <Menu.Positioner data-testid="positioner">
                <Menu.Popup />
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>,
        );

        const backdrop = getBackdrop();
        expect(backdrop !== null).toBe(hasBackdrop);
        expect(screen.getByTestId('positioner').previousElementSibling).toBe(backdrop);
      },
    );

    it('renders it before Menu.Backdrop, and a press on Menu.Backdrop closes the menu', async () => {
      const onOpenChange = vi.fn();
      await render(
        <Menu.Root defaultOpen onOpenChange={onOpenChange}>
          <Menu.Portal data-testid="portal">
            <Menu.Backdrop data-testid="backdrop" style={{ position: 'fixed', inset: 0 }} />
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );
      const backdrop = screen.getByTestId('backdrop');
      expect(backdrop.previousElementSibling).toBe(getBackdrop());
      expect(document.elementFromPoint(300, 300)).toBe(backdrop);

      await userEvent.click(document.body, { position: { x: 300, y: 300 } });
      await flushMicrotasks();

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.outsidePress);
    });

    it('renders it before the positioner in the element of the #render slot', async () => {
      await render(
        <Menu.Root defaultOpen>
          <Menu.Portal
            v-slots={{
              render: ({ props, children }: RenderSlotProps) => (
                <section {...props} data-testid="portal">
                  {h(children, null, () => (
                    <Menu.Positioner data-testid="positioner">
                      <Menu.Popup />
                    </Menu.Positioner>
                  ))}
                </section>
              ),
            }}
          />
        </Menu.Root>,
      );

      const backdrop = getBackdrop();
      expect(backdrop).not.toBe(null);
      expect(screen.getByTestId('positioner').previousElementSibling).toBe(backdrop);
    });

    it('cuts the trigger out of the backdrop', async () => {
      await render(
        <Menu.Root defaultOpen defaultTriggerId="trigger">
          <Menu.Trigger
            id="trigger"
            style={{ position: 'fixed', left: '10px', top: '20px', width: '30px', height: '40px' }}
          />
          <Menu.Portal data-testid="portal">
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const clipPath = getBackdrop()!.style.clipPath;
      expect(clipPath).toContain('10px 20px');
      expect(clipPath).toContain('40px 60px');
    });

    it('renders no backdrop for a menu that a hover opened', async () => {
      const probe = createMenuStoreProbe();
      await render(
        <Menu.Root>
          <probe.Probe />
          <Menu.Portal data-testid="portal">
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      probe.store.setOpen(
        true,
        createChangeEventDetails(REASONS.triggerHover, new MouseEvent('mouseenter')),
      );
      await flushMicrotasks();

      expect(probe.store.select('mounted')).toBe(true);
      expect(getBackdrop()).toBe(null);
    });

    it('is inert while the menu closes, and leaves when the menu unmounts', async () => {
      let root!: Menu.Root.Actions;
      await render(() => (
        <Menu.Root
          ref={(instance: unknown) => {
            root = instance as Menu.Root.Actions;
          }}
          defaultOpen
          onOpenChange={(_open, eventDetails) => eventDetails.preventUnmountOnClose()}
        >
          <Menu.Portal data-testid="portal">
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));
      const backdrop = getBackdrop()!;
      expect(backdrop.inert).toBe(false);

      root.close();
      await flushMicrotasks();
      expect(backdrop.inert).toBe(true);

      root.unmount();
      await flushMicrotasks();
      expect(backdrop.isConnected).toBe(false);
    });

    it.each([
      { name: 'a modal menubar', modal: true, hasBackdrop: true },
      { name: 'a menubar that is not modal', modal: false, hasBackdrop: false },
    ])('follows the modal state of $name', async ({ modal, hasBackdrop }) => {
      const menubar = addElement(
        'position: fixed; left: 50px; top: 5px; width: 100px; height: 20px',
      );
      const context = createMenubarContext({
        modal: computed(() => modal),
        contentElement: shallowRef(menubar),
      });
      await render(
        <MenubarProvider context={context}>
          <Menu.Root defaultOpen>
            <Menu.Portal data-testid="portal">
              <Menu.Positioner>
                <Menu.Popup />
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </MenubarProvider>,
      );

      const backdrop = getBackdrop();
      expect(backdrop !== null).toBe(hasBackdrop);
      if (backdrop) {
        expect(backdrop.style.clipPath).toContain('50px 5px');
        expect(backdrop.style.clipPath).toContain('150px 25px');
      }
    });

    it('gives the backdrop to the context menu above it, and takes it back at the unmount', async () => {
      const context = createContextMenuContext();
      let root!: Menu.Root.Actions;
      await render(() => (
        <ContextMenuProvider context={context}>
          <Menu.Root
            ref={(instance: unknown) => {
              root = instance as Menu.Root.Actions;
            }}
            defaultOpen
          >
            <Menu.Portal data-testid="portal">
              <Menu.Positioner>
                <Menu.Popup />
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </ContextMenuProvider>
      ));
      const backdrop = getBackdrop();
      expect(backdrop).not.toBe(null);
      expect(context.internalBackdropRef.value).toBe(backdrop);
      expect(backdrop!.style.clipPath).toBe('');

      root.close();
      await flushMicrotasks();

      expect(backdrop!.isConnected).toBe(false);
      expect(context.internalBackdropRef.value).toBe(null);
    });

    it('keeps the backdrop of a portal in the context menu when another portal of the menu unmounts', async () => {
      const context = createContextMenuContext();
      const showOther = shallowRef(true);
      await render(() => (
        <ContextMenuProvider context={context}>
          <Menu.Root defaultOpen>
            {showOther.value ? <Menu.Portal key="other" /> : null}
            <Menu.Portal key="portal" data-testid="portal">
              <Menu.Positioner>
                <Menu.Popup />
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </ContextMenuProvider>
      ));
      const backdrop = getBackdrop();
      expect(context.internalBackdropRef.value).toBe(backdrop);

      showOther.value = false;
      await flushMicrotasks();

      expect(context.internalBackdropRef.value).toBe(backdrop);
    });
  });
});
