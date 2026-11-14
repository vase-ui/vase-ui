import { describe, expect, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import * as Menu from '../index.parts';
import { createRenderer, describeConformance, screen } from '#test-utils';
import { MenubarProvider, createMenubarContext } from '../../../test/fixtures/MenuParentFixture';
import FocusManagerPart from '../../../test/fixtures/FocusManagerPart.vue';
import { createAttribute } from '../../utils/popups/createAttribute';

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
});
