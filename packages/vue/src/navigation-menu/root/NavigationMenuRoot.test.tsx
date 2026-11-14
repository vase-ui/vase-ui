import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  waitFor,
} from '#test-utils';
import * as Dialog from '../../dialog/index.parts';
import * as NavigationMenu from '../index.parts';
import { OPEN_DELAY } from '../utils/constants';
import NavigationMenuRootHydration from './NavigationMenuRootHydration.test.vue';
import { useNavigationMenuRootContext } from './NavigationMenuRootContext';

const HYDRATION_FIXTURE = 'src/navigation-menu/root/NavigationMenuRootHydration.test.vue';

type RootInstance = NavigationMenu.Root.Actions & { element: HTMLElement | null };

// The root waits for the animations of its popup element before it unmounts the popup. This
// component gives the root an element to wait for.
const PopupElement = defineComponent(() => {
  const { popupElement } = useNavigationMenuRootContext();

  return () => (
    <div
      data-testid="popup"
      ref={(element) => {
        popupElement.value = element as HTMLElement | null;
      }}
    />
  );
});

describe('<NavigationMenu.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<NavigationMenu.Root />, () => ({
    refInstanceof: window.HTMLElement,
    render(node) {
      return render(node);
    },
  }));

  /**
   * A menu with one item that is open, and a popup element. `log` gets one line for each emit of
   * the value.
   */
  async function renderMenu(
    onValueChange?: (value: string | null, details: NavigationMenu.Root.ChangeEventDetails) => void,
  ) {
    const handle: { root: RootInstance | null } = { root: null };
    const log: string[] = [];
    const handleOpenChangeComplete = vi.fn();

    await render(() => (
      <NavigationMenu.Root
        ref={(instance) => {
          handle.root = instance as unknown as RootInstance | null;
        }}
        defaultValue="item-1"
        onValueChange={(value, details) => {
          log.push(`valueChange ${value} ${details.reason}`);
          onValueChange?.(value, details);
        }}
        onUpdate:value={(value) => {
          log.push(`update:value ${value}`);
        }}
        onOpenChangeComplete={handleOpenChangeComplete}
      >
        <NavigationMenu.List>
          <NavigationMenu.Item value="item-1">
            <NavigationMenu.Icon data-testid="icon" />
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <PopupElement />
      </NavigationMenu.Root>
    ));

    return { root: handle.root as RootInstance, log, handleOpenChangeComplete };
  }

  describe('tag', () => {
    it('renders a nav element, and a div element when nested', async () => {
      await render(
        <NavigationMenu.Root data-testid="root">
          <NavigationMenu.Root data-testid="nested-root" />
        </NavigationMenu.Root>,
      );

      const root = screen.getByTestId('root');
      const nestedRoot = screen.getByTestId('nested-root');
      expect(root.localName).toBe('nav');
      expect(root).not.toHaveAttribute('data-nested');
      expect(nestedRoot.localName).toBe('div');
      expect(nestedRoot).toHaveAttribute('data-nested');
    });

    it('renders the tag of `as` in place of the default tag, also when nested', async () => {
      await render(
        <NavigationMenu.Root as="section" data-testid="root">
          <NavigationMenu.Root as="aside" data-testid="nested-root" />
        </NavigationMenu.Root>,
      );

      expect(screen.getByTestId('root').localName).toBe('section');
      expect(screen.getByTestId('nested-root').localName).toBe('aside');
    });
  });

  describe('nested popups', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const TestNavigationMenuWithNestedPopup = defineComponent((_props, { slots }) => () => (
      <NavigationMenu.Root>
        <NavigationMenu.List>
          <NavigationMenu.Item value="item-1">
            <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>

            <NavigationMenu.Content data-testid="popup-1">
              {slots.default?.()}
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
      </NavigationMenu.Root>
    ));

    function TestNavigationMenuWithDialog() {
      return (
        <TestNavigationMenuWithNestedPopup>
          <Dialog.Root>
            <Dialog.Trigger data-testid="dialog-trigger">Open dialog</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Popup
                data-testid="dialog-popup"
                onClick={(event) => {
                  event.stopPropagation();
                }}
              >
                <button type="button" data-testid="dialog-button">
                  Dialog button
                </button>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </TestNavigationMenuWithNestedPopup>
      );
    }

    it('keeps a hover-open menu open when pointerdown happens on a nested dialog trigger', async () => {
      const { user } = await render(<TestNavigationMenuWithDialog />);
      const trigger = screen.getByTestId('trigger-1');

      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);
      vi.advanceTimersByTime(OPEN_DELAY);
      await flushMicrotasks();

      const popup = screen.getByTestId('popup-1');
      const dialogTrigger = screen.getByTestId('dialog-trigger');

      await fireEvent.pointerDown(dialogTrigger, { pointerType: 'mouse' });
      await fireEvent.mouseLeave(popup);

      await user.click(dialogTrigger);

      expect(await screen.findByTestId('dialog-popup')).not.toBe(null);
      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('keeps the menu open when interacting with a nested dialog', async () => {
      const { user } = await render(<TestNavigationMenuWithDialog />);
      const trigger = screen.getByTestId('trigger-1');

      await user.click(trigger);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).not.toBe(null);
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      const dialogTrigger = screen.getByTestId('dialog-trigger');
      await user.click(dialogTrigger);

      expect(await screen.findByTestId('dialog-popup')).not.toBe(null);

      await user.click(screen.getByTestId('dialog-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).not.toBe(null);
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('open item', () => {
    function renderIcons() {
      return (
        <NavigationMenu.List>
          <NavigationMenu.Item value="item-1">
            <NavigationMenu.Icon data-testid="icon-1" />
          </NavigationMenu.Item>
          <NavigationMenu.Item value="item-2">
            <NavigationMenu.Icon data-testid="icon-2" />
          </NavigationMenu.Item>
        </NavigationMenu.List>
      );
    }

    it('opens the item of defaultValue', async () => {
      await render(
        <NavigationMenu.Root data-testid="root" defaultValue="item-2">
          {renderIcons()}
        </NavigationMenu.Root>,
      );

      expect(screen.getByTestId('root')).toHaveAttribute('data-open');
      expect(screen.getByTestId('icon-1')).not.toHaveAttribute('data-popup-open');
      expect(screen.getByTestId('icon-2')).toHaveAttribute('data-popup-open');
    });

    it('opens the item of the value prop, and follows a change of it', async () => {
      const { setProps } = await render(
        <NavigationMenu.Root value="item-1">{renderIcons()}</NavigationMenu.Root>,
      );
      expect(screen.getByTestId('icon-1')).toHaveAttribute('data-popup-open');

      await setProps({ value: 'item-2' });

      expect(screen.getByTestId('icon-1')).not.toHaveAttribute('data-popup-open');
      expect(screen.getByTestId('icon-2')).toHaveAttribute('data-popup-open');

      await setProps({ value: null });

      expect(screen.getByTestId('icon-2')).not.toHaveAttribute('data-popup-open');
    });

    it('follows v-model:value, and writes it when the menu closes', async () => {
      const model = shallowRef<string | null>('item-1');
      const handle: { root: RootInstance | null } = { root: null };
      const App = defineComponent(() => () => (
        <NavigationMenu.Root
          ref={(instance) => {
            handle.root = instance as unknown as RootInstance | null;
          }}
          v-model:value={model.value}
        >
          {renderIcons()}
        </NavigationMenu.Root>
      ));
      await render(<App />);
      expect(screen.getByTestId('icon-1')).toHaveAttribute('data-popup-open');

      model.value = 'item-2';
      await flushMicrotasks();
      expect(screen.getByTestId('icon-2')).toHaveAttribute('data-popup-open');

      handle.root!.close();
      await flushMicrotasks();

      expect(model.value).toBe(null);
      expect(screen.getByTestId('icon-2')).not.toHaveAttribute('data-popup-open');
    });

    it.each([
      { name: 'defaultValue 0', controlled: false, itemValue: 0 },
      { name: 'defaultValue an empty string', controlled: false, itemValue: '' },
      { name: 'defaultValue false', controlled: false, itemValue: false },
      { name: 'value 0', controlled: true, itemValue: 0 },
      { name: 'value an empty string', controlled: true, itemValue: '' },
      { name: 'value false', controlled: true, itemValue: false },
    ])('treats $name as an open value', async ({ controlled, itemValue }) => {
      const rootProps = controlled ? { value: itemValue } : { defaultValue: itemValue };

      await render(
        <NavigationMenu.Root data-testid="root" {...rootProps}>
          <NavigationMenu.List>
            <NavigationMenu.Item value={itemValue}>
              <NavigationMenu.Icon data-testid="icon" />
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>,
      );

      expect(screen.getByTestId('root')).toHaveAttribute('data-open');
      expect(screen.getByTestId('icon')).toHaveAttribute('data-popup-open');
    });

    it('stays uncontrolled when the value prop is absent', async () => {
      const { root } = await renderMenu();
      expect(screen.getByTestId('icon')).toHaveAttribute('data-popup-open');

      root.close();
      await flushMicrotasks();

      expect(screen.getByTestId('icon')).not.toHaveAttribute('data-popup-open');
    });
  });

  describe('exposed close', () => {
    it('emits valueChange with the reason imperative-action, and then update:value', async () => {
      const { root, log } = await renderMenu();

      root.close();

      expect(log).toEqual(['valueChange null imperative-action', 'update:value null']);
    });

    it('keeps the menu open, and emits no update:value, when valueChange cancels the close', async () => {
      const { root, log, handleOpenChangeComplete } = await renderMenu((_value, details) => {
        details.cancel();
      });

      root.close();
      await flushMicrotasks();

      expect(log).toEqual(['valueChange null imperative-action']);
      expect(screen.getByTestId('icon')).toHaveAttribute('data-popup-open');
      expect(handleOpenChangeComplete).not.toHaveBeenCalled();
    });

    it('emits nothing when the menu is already closed', async () => {
      const { root, log } = await renderMenu();

      root.close();
      root.close();

      expect(log).toEqual(['valueChange null imperative-action', 'update:value null']);
    });

    it('closes a nested root and keeps the root above it open', async () => {
      const handleOuterChange = vi.fn();
      const handle: { nestedRoot: RootInstance | null } = { nestedRoot: null };
      await render(() => (
        <NavigationMenu.Root defaultValue="outer" onValueChange={handleOuterChange}>
          <NavigationMenu.Root
            ref={(instance) => {
              handle.nestedRoot = instance as unknown as RootInstance | null;
            }}
            defaultValue="inner"
          />
        </NavigationMenu.Root>
      ));

      handle.nestedRoot!.close();

      expect(handleOuterChange).not.toHaveBeenCalled();
    });
  });

  describe('end of the close', () => {
    it('emits openChangeComplete one time after the close', async () => {
      const { root, handleOpenChangeComplete } = await renderMenu();

      root.close();
      await flushMicrotasks();
      expect(handleOpenChangeComplete).toHaveBeenCalledExactlyOnceWith(false);

      root.unmount();
      await flushMicrotasks();
      expect(handleOpenChangeComplete).toHaveBeenCalledTimes(1);
    });

    it('waits for unmount() when valueChange calls details.preventUnmountOnClose()', async () => {
      const { root, handleOpenChangeComplete } = await renderMenu((_value, details) => {
        details.preventUnmountOnClose();
      });

      root.close();
      await flushMicrotasks();
      expect(handleOpenChangeComplete).not.toHaveBeenCalled();

      root.unmount();
      await flushMicrotasks();
      expect(handleOpenChangeComplete).toHaveBeenCalledExactlyOnceWith(false);
    });

    it('keeps the request of preventUnmountOnClose() when a second close changes nothing', async () => {
      const { root, handleOpenChangeComplete } = await renderMenu((_value, details) => {
        details.preventUnmountOnClose();
      });

      root.close();
      root.close();
      await flushMicrotasks();
      expect(handleOpenChangeComplete).not.toHaveBeenCalled();

      root.unmount();
      await flushMicrotasks();
      expect(handleOpenChangeComplete).toHaveBeenCalledExactlyOnceWith(false);
    });

    it('does nothing for unmount() while the menu is open', async () => {
      const { root, handleOpenChangeComplete } = await renderMenu();

      root.unmount();
      await flushMicrotasks();

      expect(handleOpenChangeComplete).not.toHaveBeenCalled();
      expect(screen.getByTestId('icon')).toHaveAttribute('data-popup-open');
    });
  });

  describe('hydration', () => {
    it.each([
      { name: 'a closed menu', props: {}, open: false },
      { name: 'a menu with defaultValue', props: { defaultValue: 'item-1' }, open: true },
    ])('hydrates $name', async ({ props, open }) => {
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);

      const { container } = await hydrate(NavigationMenuRootHydration, { serverHtml, props });

      const icon = container.querySelector('[data-testid="icon-1"]');
      expect(icon?.hasAttribute('data-popup-open')).toBe(open);
      expect(container.querySelector('[data-testid="root"]')?.localName).toBe('nav');
    });
  });
});
