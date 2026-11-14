import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { KeepAlive, computed, defineComponent, nextTick, shallowRef } from 'vue';
import * as Menu from '../index.parts';
import { Toolbar } from '@vase-ui/vue/toolbar';
import { Menubar } from '@vase-ui/vue/menubar';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  isJSDOM,
  screen,
  takeReportedMessages,
  wait,
  waitFor,
  waitForLaterMillisecond,
  waitSingleFrame,
} from '#test-utils';
import CompositeRootPart from '../../../test/fixtures/CompositeRootPart.vue';
import { MenubarProvider, createMenubarContext } from '../../../test/fixtures/MenuParentFixture';
import { createMenuStoreProbe } from '../../../test/fixtures/MenuStoreProbe';
import { PATIENT_CLICK_THRESHOLD } from '../../internals/constants';
import * as Popover from '../../popover/index.parts';
import { createAttribute } from '../../utils/popups/createAttribute';
import { provideFloatingNode, useFloatingTree } from '../../utils/popups/tree/FloatingTree';
import type { FloatingTreeType } from '../../utils/popups/types';
import MenuTriggerScoped from './MenuTriggerScoped.test.vue';

const popup = (
  <Menu.Portal>
    <Menu.Positioner>
      <Menu.Popup data-testid="popup" />
    </Menu.Positioner>
  </Menu.Portal>
);

describe('<Menu.Trigger />', () => {
  const { render } = createRenderer();

  describeConformance(<Menu.Trigger />, () => ({
    refInstanceof: window.HTMLButtonElement,
    testRenderPropWith: 'button',
    button: true,
    render: (node) => {
      return render(<Menu.Root open>{node}</Menu.Root>);
    },
  }));

  describe.skipIf(isJSDOM)('tabbing backward from the open trigger', () => {
    it.each([true, false])('focuses the preceding element when modal=%s', async (modal) => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      await render(
        <div>
          <button>Before</button>
          <Menu.Root modal={modal}>
            <Menu.Trigger>Toggle</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Item</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>,
      );

      const trigger = screen.getByRole('button', { name: 'Toggle' });
      await userEvent.click(trigger);
      await waitFor(() => {
        expect(screen.getByRole('menu')).toHaveFocus();
      });

      // Menu normally closes on Shift+Tab from its content. Focus the trigger while it stays open.
      trigger.focus();
      await flushMicrotasks();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await userEvent.tab({ shift: true });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Before' })).toHaveFocus();
      });
      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
      });
    });
  });

  describe('prop: disabled', () => {
    it('should render a disabled button', async () => {
      await render(
        <Menu.Root>
          <Menu.Trigger disabled />
        </Menu.Root>,
      );

      const button = screen.getByRole('button');
      expect(button).toHaveProperty('disabled', true);
    });

    it('should not open the menu when clicked', async () => {
      const { user } = await render(
        <Menu.Root>
          <Menu.Trigger disabled />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const button = screen.getByRole('button');
      await user.click(button);
      await waitSingleFrame();
      await flushMicrotasks();

      expect(screen.queryByRole('menu', { hidden: false })).toBe(null);
    });

    it.each([
      { name: 'the disabled prop', root: false, prop: true },
      { name: 'a disabled root', root: true, prop: false },
    ])('is disabled by $name', async ({ root, prop }) => {
      await render(
        <Menu.Root disabled={root}>
          <Menu.Trigger disabled={prop}>Open</Menu.Trigger>
        </Menu.Root>,
      );

      const button = screen.getByRole('button');
      expect(button).toHaveProperty('disabled', true);
      expect(button).toHaveAttribute('data-disabled');
    });

    it('is disabled by a disabled menubar above a trigger that has a handle', async () => {
      const handle = Menu.createHandle();
      await render(
        <div>
          <MenubarProvider context={createMenubarContext({ disabled: computed(() => true) })}>
            <CompositeRootPart>
              <Menu.Trigger handle={handle}>Open</Menu.Trigger>
            </CompositeRootPart>
          </MenubarProvider>
          <Menu.Root handle={handle} />
        </div>,
      );

      const button = screen.getByRole('menuitem');
      expect(button).toHaveProperty('disabled', true);
      expect(button).toHaveAttribute('data-disabled');
    });

    it('is not disabled by default', async () => {
      await render(
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
        </Menu.Root>,
      );

      const button = screen.getByRole('button');
      expect(button).toHaveProperty('disabled', false);
      expect(button).not.toHaveAttribute('data-disabled');
    });
  });

  it('removes the hover mouseup listener when unmounted before mouseup', async () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    try {
      const { user, unmount } = await render(
        <Menu.Root>
          <Menu.Trigger delay={0} openOnHover>
            Open
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      addEventListenerSpy.mockClear();
      await user.hover(trigger);
      await screen.findByRole('menu', { hidden: false });

      const mouseUpListener = addEventListenerSpy.mock.calls.find(
        (call) => call[0] === 'mouseup',
      )?.[1];
      expect(mouseUpListener).toBeTypeOf('function');

      unmount();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', mouseUpListener);
    } finally {
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    }
  });

  it.each([
    { name: 'stays open when the mouseup lands inside the popup', insidePopup: true },
    { name: 'closes when the mouseup lands outside the popup', insidePopup: false },
  ])('a hover-opened menu in a shadow root $name', async ({ insidePopup }) => {
    const host = document.createElement('div');
    document.body.append(host);
    const shadowRoot = host.attachShadow({ mode: 'open' });

    try {
      const { user } = await render(
        <Menu.Root>
          <Menu.Trigger delay={0} openOnHover>
            Open
          </Menu.Trigger>
          <Menu.Portal container={shadowRoot}>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.hover(trigger);
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });

      const popup = shadowRoot.querySelector('[role="menu"]');
      expect(popup).not.toBe(null);

      await fireEvent.mouseUp(insidePopup ? popup! : document.body, {
        clientX: 500,
        clientY: 500,
      });
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', String(insidePopup));
    } finally {
      host.remove();
    }
  });

  describe('style hooks', () => {
    it('should have the data-popup-open and data-pressed attributes when open', async () => {
      await render(
        <Menu.Root>
          <Menu.Trigger />
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button');

      trigger.click();
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('data-popup-open');
      expect(trigger).toHaveAttribute('data-pressed');
    });

    it('keeps the data-popup-open attribute and handle.isOpen when a controlled close is vetoed', async () => {
      const handle = Menu.createHandle();

      const TestCase = defineComponent(() => {
        const open = shallowRef(false);

        return () => (
          <>
            <Menu.Root
              handle={handle}
              open={open.value}
              onOpenChange={(nextOpen: boolean) => {
                if (nextOpen) {
                  open.value = true;
                }
              }}
            >
              <Menu.Trigger>Actions</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item>Item</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <button type="button">Outside</button>
          </>
        );
      });

      const { user } = await render(<TestCase />);

      const trigger = screen.getByRole('button', { name: 'Actions' });
      await user.click(trigger);

      await screen.findByRole('menu');
      expect(trigger).toHaveAttribute('data-popup-open');
      expect(handle.isOpen).toBe(true);

      await user.click(screen.getByRole('button', { name: 'Outside' }));

      expect(screen.getByRole('menu')).toHaveAttribute('data-open');
      expect(trigger).toHaveAttribute('data-popup-open');
      expect(handle.isOpen).toBe(true);
    });
  });

  describe('impatient clicks with `openOnHover=true`', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function tick(ms: number) {
      vi.advanceTimersByTime(ms);
      await flushMicrotasks();
    }

    it('does not close the menu if the user clicks too quickly', async () => {
      await render(
        <Menu.Root>
          <Menu.Trigger delay={0} openOnHover />
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button');

      await fireEvent.mouseMove(trigger);

      await tick(PATIENT_CLICK_THRESHOLD - 1);

      await fireEvent.click(trigger);

      expect(trigger).toHaveAttribute('data-popup-open');
    });

    it('closes the menu if the user clicks patiently', async () => {
      await render(
        <Menu.Root>
          <Menu.Trigger delay={0} openOnHover />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button');

      await fireEvent.mouseEnter(trigger);

      await tick(PATIENT_CLICK_THRESHOLD);

      await fireEvent.click(trigger);

      expect(trigger).not.toHaveAttribute('data-popup-open');

      // Leaving the trigger afterwards doesn't reopen it.
      await fireEvent.mouseLeave(trigger);

      expect(trigger).not.toHaveAttribute('data-popup-open');
    });

    it('sticks if the user clicks impatiently', async () => {
      await render(
        <Menu.Root>
          <Menu.Trigger delay={0} openOnHover />
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button');

      await fireEvent.mouseEnter(trigger);

      await tick(PATIENT_CLICK_THRESHOLD - 1);

      await fireEvent.click(trigger);
      await fireEvent.mouseLeave(trigger);

      expect(trigger).toHaveAttribute('data-popup-open');

      await tick(1);

      expect(trigger).toHaveAttribute('data-popup-open');
    });

    it('sticks when clicked before the hover delay completes', async () => {
      await render(
        <Menu.Root>
          <Menu.Trigger openOnHover delay={300}>
            Open
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>Content</Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button');

      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);

      await tick(100);

      // User clicks impatiently to open
      await fireEvent.click(trigger);

      expect(trigger).toHaveAttribute('data-popup-open');

      await fireEvent.mouseLeave(trigger);

      expect(trigger).toHaveAttribute('data-popup-open');
    });

    it('should keep the menu open when re-hovered and clicked within the patient threshold', async () => {
      await render(
        <Menu.Root>
          <Menu.Trigger openOnHover delay={100}>
            Open
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>Content</Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button');

      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);

      await tick(100);
      await flushMicrotasks();

      expect(screen.getByText('Content')).not.toBe(null);

      await tick(PATIENT_CLICK_THRESHOLD);

      await fireEvent.mouseLeave(trigger);
      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);

      await fireEvent.click(trigger);
      expect(screen.getByText('Content')).not.toBe(null);
    });
  });

  it('keeps a hover-opened menu open when mouseup lands outside the trigger DOM but within its bounds', async () => {
    const { user } = await render(
      <Menu.Root>
        <Menu.Trigger
          openOnHover
          delay={0}
          style={{ width: '120px', height: '40px', display: 'block' }}
        >
          Open
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.hover(trigger);
    expect(screen.queryByRole('menu')).not.toBe(null);

    const rect = trigger.getBoundingClientRect();
    await fireEvent.mouseUp(document.body, {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    });

    expect(screen.queryByRole('menu')).not.toBe(null);
  });

  describe('preventBaseUIHandler', () => {
    it('prevents opening the menu with a mouse when `preventBaseUIHandler` is called in onMouseDown', async () => {
      const { user } = await render(
        <Menu.Root>
          <Menu.Trigger onMousedown={(event) => event.preventVaseUIHandler()} />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const button = screen.getByRole('button');
      await user.click(button);
      await waitSingleFrame();
      await flushMicrotasks();

      expect(screen.queryByRole('menu', { hidden: false })).toBe(null);
    });

    it('prevents opening the menu with keyboard when `preventBaseUIHandler` is called in onClick', async () => {
      const { user } = await render(
        <Menu.Root>
          <Menu.Trigger onClick={(event) => event.preventVaseUIHandler()} />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const button = screen.getByRole('button');
      button.focus();
      await flushMicrotasks();

      await user.keyboard('[Enter]');

      expect(screen.queryByRole('menu', { hidden: false })).toBe(null);
    });
  });

  describe('press, drag and release', () => {
    it('does not let a release activate an item after the menu that the press opened closes', async () => {
      const onClick = vi.fn();
      const handle = Menu.createHandle();
      await render(
        <Menu.Root handle={handle}>
          <Menu.Trigger id="trigger">Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item onClick={onClick}>Item</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      await fireEvent.mouseDown(screen.getByRole('button', { name: 'Open' }));
      await screen.findByRole('menu');
      // After 200 ms of a held press, a release over an item activates the item.
      await wait(250);
      await fireEvent.keyDown(document.body, { key: 'Escape' });
      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
      });

      handle.open('trigger');
      const item = await screen.findByRole('menuitem');
      await waitForLaterMillisecond();
      await fireEvent.mouseUp(item);

      expect(onClick).not.toHaveBeenCalled();
    });

    it('VUE-5: removes the mouseup listener of a press while KeepAlive holds the trigger', async () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      onTestFinished(() => {
        addEventListenerSpy.mockRestore();
        removeEventListenerSpy.mockRestore();
      });
      const visible = shallowRef(true);
      const Other = defineComponent({ setup: () => () => <span /> });
      await render(() => (
        <Menu.Root>
          <KeepAlive>
            {visible.value ? (
              <Menu.Trigger key="trigger">Open</Menu.Trigger>
            ) : (
              <Other key="other" />
            )}
          </KeepAlive>
        </Menu.Root>
      ));

      addEventListenerSpy.mockClear();
      await fireEvent.mouseDown(screen.getByRole('button', { name: 'Open' }));
      const mouseUpListener = addEventListenerSpy.mock.calls.find(
        (call) => call[0] === 'mouseup',
      )?.[1];
      expect(mouseUpListener).toBeTypeOf('function');

      visible.value = false;
      await flushMicrotasks();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', mouseUpListener);
    });
  });

  describe('attributes', () => {
    it('has the attributes of a trigger of a closed menu', async () => {
      await render(
        <Menu.Root>
          <Menu.Trigger id="trigger">Open</Menu.Trigger>
          {popup}
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      expect(trigger).toHaveAttribute('id', 'trigger');
      expect(trigger).toHaveAttribute('type', 'button');
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).not.toHaveAttribute('aria-controls');
      expect(trigger).not.toHaveAttribute('data-popup-open');
      expect(trigger).not.toHaveAttribute('data-pressed');
      expect(trigger).not.toHaveAttribute('role');
    });

    it('has the attributes of the trigger that owns an open menu', async () => {
      await render(
        <Menu.Root defaultOpen defaultTriggerId="first">
          <Menu.Trigger id="first">First</Menu.Trigger>
          <Menu.Trigger id="second">Second</Menu.Trigger>
          {popup}
        </Menu.Root>,
      );

      const first = screen.getByRole('button', { name: 'First' });
      const second = screen.getByRole('button', { name: 'Second' });
      expect(first).toHaveAttribute('aria-expanded', 'true');
      expect(first).toHaveAttribute('aria-controls', screen.getByTestId('popup').id);
      expect(first).toHaveAttribute('data-popup-open');
      expect(first).toHaveAttribute('data-pressed');

      expect(second).toHaveAttribute('aria-expanded', 'false');
      expect(second).not.toHaveAttribute('aria-controls');
      expect(second).not.toHaveAttribute('data-popup-open');
      expect(second).toHaveAttribute('aria-haspopup', 'menu');
    });

    it('renders a toolbar button as its element, and the button is an item of the toolbar', async () => {
      await render(
        <Toolbar.Root>
          <Menu.Root>
            <Menu.Trigger as={Toolbar.Button} data-testid="button">
              Toggle
            </Menu.Trigger>
            {popup}
          </Menu.Root>
        </Toolbar.Root>,
      );

      const button = screen.getByTestId('button');
      expect(button).toHaveAttribute('aria-haspopup', 'menu');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAttribute('tabindex', '0');
    });

    it('gives a trigger that is not a native button the button role', async () => {
      await render(
        <Menu.Root>
          <Menu.Trigger as="span" nativeButton={false} data-testid="trigger" />
        </Menu.Root>,
      );

      expect(screen.getByTestId('trigger')).toHaveAttribute('role', 'button');
    });
  });

  describe('state of the root', () => {
    it('follows the open state of its root', async () => {
      const open = shallowRef(false);
      await render(() => (
        <Menu.Root open={open.value}>
          <Menu.Trigger>Open</Menu.Trigger>
          {popup}
        </Menu.Root>
      ));
      const trigger = screen.getByRole('button');
      expect(trigger).not.toHaveAttribute('data-popup-open');

      open.value = true;
      await flushMicrotasks();
      expect(trigger).toHaveAttribute('data-popup-open');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      open.value = false;
      await flushMicrotasks();
      expect(trigger).not.toHaveAttribute('data-popup-open');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('gives its payload to the menu while it owns the menu', async () => {
      const handle = Menu.createHandle<string>();
      await render(
        <Menu.Root handle={handle}>
          {{
            default: ({ payload }: { payload: string | undefined }) => (
              <div>
                <Menu.Trigger id="one" payload="payload one">
                  One
                </Menu.Trigger>
                <Menu.Trigger id="two" payload="payload two">
                  Two
                </Menu.Trigger>
                <span data-testid="payload">{String(payload)}</span>
              </div>
            ),
          }}
        </Menu.Root>,
      );
      expect(screen.getByTestId('payload')).toHaveTextContent('undefined');

      handle.open('one');
      await flushMicrotasks();
      expect(screen.getByTestId('payload')).toHaveTextContent('payload one');

      handle.open('two');
      await flushMicrotasks();
      expect(screen.getByTestId('payload')).toHaveTextContent('payload two');
    });
  });

  describe('prop: handle', () => {
    it('opens the menu of its handle, and reports the open state of its menu', async () => {
      const handle = Menu.createHandle<string>();
      const onOpenChangeComplete = vi.fn();
      await render(
        <div>
          <Menu.Trigger handle={handle} id="detached" payload="detached payload">
            Detached
          </Menu.Trigger>
          <Menu.Root handle={handle} onOpenChangeComplete={onOpenChangeComplete}>
            {{
              default: ({ payload }: { payload: string | undefined }) => (
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>{payload}</Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              ),
            }}
          </Menu.Root>
        </div>,
      );
      const trigger = screen.getByRole('button', { name: 'Detached' });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('menu')).toBe(null);

      handle.open('detached');
      await waitFor(() => {
        expect(screen.getByRole('menu')).toHaveTextContent('detached payload');
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('data-popup-open');
      expect(screen.getByRole('menu')).toHaveAttribute('aria-labelledby', 'detached');

      handle.close();
      await waitFor(() => {
        expect(onOpenChangeComplete).toHaveBeenCalledWith(false);
      });
      await flushMicrotasks();
      expect(screen.queryByRole('menu')).toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('data for the store', () => {
    const TreeProbe = defineComponent({
      props: { onTree: { type: Function, required: true } },
      setup(props) {
        const tree = useFloatingTree();
        return () => {
          (props.onTree as (value: FloatingTreeType | null) => void)(tree.value);
          return null;
        };
      },
    });

    it('gives the tree and the node of a detached trigger to the menu', async () => {
      const handle = Menu.createHandle();
      const probe = createMenuStoreProbe();
      const trees: (FloatingTreeType | null)[] = [];
      await render(
        <div>
          <Menu.Trigger handle={handle} id="detached">
            Detached
          </Menu.Trigger>
          <Menu.Root handle={handle}>
            <probe.Probe />
            <TreeProbe onTree={(tree: FloatingTreeType | null) => trees.push(tree)} />
          </Menu.Root>
        </div>,
      );
      const rootTree = probe.store.select('floatingTreeRoot');
      const rootNodeId = probe.store.select('floatingNodeId');
      expect(trees.at(-1)).toBe(rootTree);

      handle.open('detached');
      await flushMicrotasks();

      const detachedTree = probe.store.select('floatingTreeRoot');
      const nodeId = probe.store.select('floatingNodeId');
      expect(detachedTree).not.toBe(rootTree);
      expect(trees.at(-1)).toBe(detachedTree);
      expect(nodeId).not.toBe(rootNodeId);
      expect(detachedTree.nodesRef.value.map((node) => node.id)).toContain(nodeId);
    });

    it('gives the parent node of a detached trigger to the menu', async () => {
      const handle = Menu.createHandle();
      const probe = createMenuStoreProbe();
      const ParentNode = defineComponent((_, { slots }) => {
        provideFloatingNode('parent');
        return () => slots.default?.();
      });
      await render(
        <div>
          <ParentNode>
            <Menu.Trigger handle={handle} id="detached">
              Detached
            </Menu.Trigger>
          </ParentNode>
          <Menu.Root handle={handle}>
            <probe.Probe />
          </Menu.Root>
        </div>,
      );
      expect(probe.store.select('floatingParentNodeId')).toBe(null);

      handle.open('detached');
      await flushMicrotasks();

      expect(probe.store.select('floatingParentNodeId')).toBe('parent');
    });

    it('VUE-55: closes the menu that a trigger in its popup opens when the menu closes', async () => {
      const outer = Menu.createHandle();
      const inner = Menu.createHandle();
      const onOuterComplete = vi.fn();
      const onInnerComplete = vi.fn();
      await render(
        <div>
          <Menu.Trigger handle={outer} id="outer-trigger">
            Outer
          </Menu.Trigger>
          <Menu.Root handle={outer} onOpenChangeComplete={onOuterComplete}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="outer-popup">
                  <Menu.Trigger handle={inner} id="inner-trigger">
                    Inner
                  </Menu.Trigger>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Menu.Root handle={inner} onOpenChangeComplete={onInnerComplete}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="inner-popup">Inner popup</Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>,
      );
      outer.open('outer-trigger');
      await waitFor(() => expect(screen.getByTestId('outer-popup')).toBeInTheDocument());
      inner.open('inner-trigger');
      await waitFor(() => expect(screen.getByTestId('inner-popup')).toBeInTheDocument());

      outer.close();

      await waitFor(() => {
        expect(onOuterComplete).toHaveBeenCalledWith(false);
      });
      await waitFor(() => {
        expect(onInnerComplete).toHaveBeenCalledWith(false);
      });
      await flushMicrotasks();
      expect(screen.queryByTestId('outer-popup')).toBe(null);
      expect(screen.queryByTestId('inner-popup')).toBe(null);
    });

    it('gives the parent and the keyboard relay of a trigger in a menubar to the menu', async () => {
      const handle = Menu.createHandle();
      const probe = createMenuStoreProbe();
      await render(
        <div>
          <MenubarProvider context={createMenubarContext()}>
            <CompositeRootPart>
              <Menu.Trigger handle={handle} id="in-menubar">
                File
              </Menu.Trigger>
            </CompositeRootPart>
          </MenubarProvider>
          <Menu.Root handle={handle}>
            <probe.Probe />
          </Menu.Root>
        </div>,
      );
      expect(probe.store.select('parent').type).toBe(undefined);
      expect(probe.store.select('keyboardEventRelay')).toBe(undefined);

      handle.open('in-menubar');
      await flushMicrotasks();

      expect(probe.store.select('parent').type).toBe('menubar');
      expect(probe.store.select('keyboardEventRelay')).toBeTypeOf('function');
    });
  });

  it('applies the props that the store has for a filter', async () => {
    const probe = createMenuStoreProbe();
    await render(
      <Menu.Root>
        <probe.Probe />
        <Menu.Trigger>Open</Menu.Trigger>
      </Menu.Root>,
    );
    expect(screen.getByRole('button')).not.toHaveAttribute('data-filter');

    probe.store.set('filterTriggerProps', { 'data-filter': '' } as never);
    await flushMicrotasks();

    expect(screen.getByRole('button')).toHaveAttribute('data-filter');
  });

  describe('in a menubar', () => {
    it('has the menuitem role and the tab stop of an item of the menubar', async () => {
      await render(
        <MenubarProvider context={createMenubarContext()}>
          <CompositeRootPart>
            <Menu.Root>
              <Menu.Trigger>File</Menu.Trigger>
            </Menu.Root>
            <Menu.Root>
              <Menu.Trigger>Edit</Menu.Trigger>
            </Menu.Root>
          </CompositeRootPart>
        </MenubarProvider>,
      );

      const items = screen.getAllByRole('menuitem');
      expect(items.map((item) => item.textContent)).toEqual(['File', 'Edit']);
      expect(items.map((item) => item.getAttribute('tabindex'))).toEqual(['0', '-1']);
    });

    it('keeps its menu open for the click that ends the press that opened it', async () => {
      await render(
        <Menubar>
          <Menu.Root>
            <Menu.Trigger>File</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="file-menu" />
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menubar>,
      );
      const trigger = screen.getByRole('menuitem', { name: 'File' });

      // The open trigger of a menubar closes its menu on `click`, so a slow press ends with a
      // click after the open.
      await fireEvent.mouseDown(trigger);
      await screen.findByTestId('file-menu');
      await fireEvent.mouseUp(trigger);
      await fireEvent.click(trigger);
      await waitSingleFrame();
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('data-popup-open');

      await fireEvent.click(trigger);

      expect(trigger).not.toHaveAttribute('data-popup-open');
    });

    it('has no focus guards while it owns the open menu', async () => {
      await render(
        <MenubarProvider context={createMenubarContext()}>
          <CompositeRootPart>
            <Menu.Root defaultOpen defaultTriggerId="file">
              <Menu.Trigger id="file">File</Menu.Trigger>
            </Menu.Root>
          </CompositeRootPart>
        </MenubarProvider>,
      );
      await flushMicrotasks();

      const trigger = screen.getByRole('menuitem', { name: 'File' });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(
        trigger.parentElement!.querySelectorAll(`[${createAttribute('focus-guard')}]`),
      ).toHaveLength(0);
    });
  });

  describe('VUE-60: the trigger has one root node', () => {
    it.each([
      { name: 'a closed menu', open: false },
      { name: 'an open menu', open: true },
    ])(
      'gives the scope id, v-show and a custom directive of the consumer to the trigger of $name',
      async ({ open }) => {
        const shown = shallowRef(true);
        await render(() => <MenuTriggerScoped open={open} shown={shown.value} />);
        await flushMicrotasks();
        const trigger = screen.getByTestId('trigger');

        expect(getComputedStyle(trigger).outlineStyle).toBe('dashed');
        expect(trigger).toHaveAttribute('data-mark', 'marked');
        // The guards of the trigger are its siblings. The portal has guards of its own in its place.
        expect(
          [trigger.previousElementSibling, trigger.nextElementSibling].map(
            (sibling) => sibling?.hasAttribute(createAttribute('focus-guard')) ?? false,
          ),
        ).toEqual([open, open]);

        shown.value = false;
        await nextTick();

        expect(trigger).not.toBeVisible();
      },
    );
  });

  describe('prop: openOnHover', () => {
    function renderMenu(trigger: Record<string, unknown>, root: Record<string, unknown> = {}) {
      return render(
        <Menu.Root {...root}>
          <Menu.Trigger {...trigger}>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner data-testid="positioner">
              <Menu.Popup data-testid="popup" />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );
    }

    async function hover(element: HTMLElement) {
      await fireEvent.mouseEnter(element);
      await fireEvent.mouseMove(element);
    }

    // A case that asserts the state before a delay ends runs the delay with a fake clock.
    function useFakeClock() {
      vi.useFakeTimers();
      onTestFinished(() => {
        vi.useRealTimers();
      });
      return async (ms: number) => {
        vi.advanceTimersByTime(ms);
        await flushMicrotasks();
      };
    }

    it('opens the menu when the pointer rests on the trigger for the delay', async () => {
      const tick = useFakeClock();
      const onOpenChange = vi.fn();
      await renderMenu({ openOnHover: true, delay: 30 }, { onOpenChange });
      const trigger = screen.getByRole('button', { name: 'Open' });

      await hover(trigger);
      await tick(29);
      expect(trigger).not.toHaveAttribute('data-popup-open');

      await tick(1);
      expect(trigger).toHaveAttribute('data-popup-open');
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe('trigger-hover');
    });

    it.each([
      { name: 'without openOnHover', trigger: {} },
      { name: 'while disabled', trigger: { openOnHover: true, disabled: true } },
    ])('does not open on hover $name', async ({ trigger }) => {
      await renderMenu({ delay: 0, ...trigger });

      await hover(screen.getByRole('button', { name: 'Open' }));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await flushMicrotasks();

      expect(screen.queryByTestId('popup')).toBe(null);
    });

    it('closes a menu that hover opened after closeDelay when the pointer leaves the trigger', async () => {
      const tick = useFakeClock();
      await renderMenu({ openOnHover: true, delay: 0, closeDelay: 40 });
      const trigger = screen.getByRole('button', { name: 'Open' });
      await hover(trigger);
      await tick(0);
      expect(trigger).toHaveAttribute('data-popup-open');

      await fireEvent.mouseLeave(trigger, { clientX: 1000, clientY: 1000 });
      await tick(39);
      expect(trigger).toHaveAttribute('data-popup-open');

      await tick(1);
      expect(trigger).not.toHaveAttribute('data-popup-open');
    });

    it('closes a menu that hover opened after closeDelay when the pointer leaves the popup', async () => {
      const tick = useFakeClock();
      await renderMenu({ openOnHover: true, delay: 0, closeDelay: 40 });
      const trigger = screen.getByRole('button', { name: 'Open' });
      await hover(trigger);
      await tick(0);
      const positioner = screen.getByTestId('positioner');

      await fireEvent.mouseEnter(positioner);
      await fireEvent.mouseLeave(positioner, { relatedTarget: document.body });
      await tick(39);
      expect(trigger).toHaveAttribute('data-popup-open');

      await tick(1);
      expect(trigger).not.toHaveAttribute('data-popup-open');
    });

    it('blocks pointer events outside a menu that hover opened', async () => {
      await renderMenu({ openOnHover: true, delay: 0 });

      await hover(screen.getByRole('button', { name: 'Open' }));
      await screen.findByTestId('popup');

      await waitFor(() => {
        expect(document.body.style.pointerEvents).toBe('none');
      });
    });
  });

  describe('hover and focus in a menubar', () => {
    function renderMenubar(fileOpen: boolean) {
      return render(
        <Menubar>
          <Menu.Root defaultOpen={fileOpen}>
            <Menu.Trigger>File</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="file-menu" />
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Menu.Root>
            <Menu.Trigger openOnHover>Edit</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="edit-menu" />
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menubar>,
      );
    }

    it('opens a menu on hover while another menu of the menubar is open', async () => {
      await renderMenubar(true);
      const edit = screen.getByRole('menuitem', { name: 'Edit' });

      await fireEvent.mouseEnter(edit);
      await fireEvent.mouseMove(edit);

      expect(await screen.findByTestId('edit-menu')).not.toBe(null);
    });

    it('opens a menu on focus while another menu of the menubar is open', async () => {
      await renderMenubar(true);

      screen.getByRole('menuitem', { name: 'Edit' }).focus();

      expect(await screen.findByTestId('edit-menu')).not.toBe(null);
    });

    it('opens no menu on hover or focus while no menu of the menubar is open', async () => {
      await renderMenubar(false);
      const edit = screen.getByRole('menuitem', { name: 'Edit' });

      await fireEvent.mouseEnter(edit);
      await fireEvent.mouseMove(edit);
      edit.focus();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await flushMicrotasks();

      expect(screen.queryByTestId('edit-menu')).toBe(null);
    });
  });

  it('does not have role prop inside a Popover', async () => {
    await render(
      <Popover.Root open>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              <Menu.Root>
                <Menu.Trigger data-testid="menu-trigger" />
              </Menu.Root>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );
    await flushMicrotasks();

    const button = screen.getByTestId('menu-trigger');
    expect(button).not.toHaveAttribute('role');
  });

  it('has a role prop inside a Popover when not a native button', async () => {
    await render(
      <Popover.Root open>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              <Menu.Root>
                <Menu.Trigger data-testid="menu-trigger" as="span" nativeButton={false} />
              </Menu.Root>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );
    await flushMicrotasks();

    const button = screen.getByTestId('menu-trigger');
    expect(button).toHaveAttribute('role', 'button');
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  it('throws without Menu.Root or a handle', async () => {
    await expect(render(<Menu.Trigger />)).rejects.toThrow(
      'Vase UI: <Menu.Trigger> must be inside <Menu.Root>, or it must have a `handle`. Without a root the trigger has no menu to open. Put the trigger inside <Menu.Root>, or pass a `handle`.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
