import { describe, expect, it, vi } from 'vitest';
import { computed, defineComponent, nextTick, shallowRef } from 'vue';
import * as Menu from '../index.parts';
import { Toolbar } from '@vase-ui/vue/toolbar';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import CompositeRootPart from '../../../test/fixtures/CompositeRootPart.vue';
import { MenubarProvider, createMenubarContext } from '../../../test/fixtures/MenuParentFixture';
import { createMenuStoreProbe } from '../../../test/fixtures/MenuStoreProbe';
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
      const trees: Array<FloatingTreeType | null> = [];
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

  describe('VUE-57: the trigger has one root node', () => {
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
