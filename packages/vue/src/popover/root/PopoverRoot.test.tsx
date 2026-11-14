import { describe, expect, it, onTestFinished } from 'vitest';
import { KeepAlive, defineComponent, shallowRef } from 'vue';
import type { PropType } from 'vue';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  waitFor,
} from '#test-utils';
import * as Popover from '../index.parts';
import { useFloatingTree } from '../../utils/popups/tree/FloatingTree';
import type { FloatingTreeType } from '../../utils/popups/types';
import PopoverRootHydration from './PopoverRootHydration.test.vue';

const HYDRATION_FILE = 'src/popover/root/PopoverRootHydration.test.vue';

type Change = [open: boolean, reason: string];

function recordChange(changes: Change[]) {
  return (open: boolean, details: Popover.Root.ChangeEventDetails) => {
    changes.push([open, details.reason]);
  };
}

interface RootInstance {
  close(): void;
  unmount(): void;
}

// A ref on a part gives its exposed members.
function createRootRef() {
  let root: RootInstance | undefined;
  return {
    ref(instance: unknown) {
      root = (instance as RootInstance | null) ?? root;
    },
    get current() {
      return root!;
    },
  };
}

// A part that calls the composable and gives the result to the test.
const TreeProbe = defineComponent({
  props: {
    report: { type: Function as PropType<(tree: FloatingTreeType | null) => void>, required: true },
  },
  setup(props) {
    props.report(useFloatingTree().value);
    return () => null;
  },
});

function createTreeReports() {
  const trees: Record<string, FloatingTreeType | null> = {};
  const report = (name: string) => (tree: FloatingTreeType | null) => {
    trees[name] = tree;
  };
  return { trees, report };
}

describe('<Popover.Root />', () => {
  const { render } = createRenderer();

  it('opens with defaultOpen and marks the trigger of defaultTriggerId', async () => {
    await render(
      <Popover.Root defaultOpen defaultTriggerId="first">
        <Popover.Trigger id="first">First</Popover.Trigger>
        <Popover.Trigger id="second">Second</Popover.Trigger>
      </Popover.Root>,
    );

    const first = screen.getByRole('button', { name: 'First' });
    const second = screen.getByRole('button', { name: 'Second' });
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(first).toHaveAttribute('data-popup-open');
    expect(first.getAttribute('aria-controls')).toMatch(/^vase-ui-/);
    expect(second).toHaveAttribute('aria-expanded', 'false');
    expect(second).not.toHaveAttribute('data-popup-open');
    expect(second).not.toHaveAttribute('aria-controls');
  });

  it('emits openChange and then update:open', async () => {
    const handle = Popover.createHandle<unknown>();
    const events: unknown[] = [];
    await render(
      <Popover.Root
        handle={handle}
        onOpenChange={(open, details) => events.push(['openChange', open, details.reason])}
        {...{ 'onUpdate:open': (open: boolean) => events.push(['update:open', open]) }}
      >
        <Popover.Trigger id="trigger" />
      </Popover.Root>,
    );

    handle.open('trigger');
    handle.close();

    expect(events).toEqual([
      ['openChange', true, 'imperative-action'],
      ['update:open', true],
      ['openChange', false, 'imperative-action'],
      ['update:open', false],
    ]);
  });

  it('does not emit update:open after cancel()', async () => {
    const handle = Popover.createHandle<unknown>();
    const changes: Change[] = [];
    const updates: boolean[] = [];
    await render(
      <Popover.Root
        handle={handle}
        onOpenChange={(open, details) => {
          changes.push([open, details.reason]);
          details.cancel();
        }}
        {...{ 'onUpdate:open': (open: boolean) => updates.push(open) }}
      >
        <Popover.Trigger id="trigger" />
      </Popover.Root>,
    );

    handle.open('trigger');
    await flushMicrotasks();

    expect(changes).toEqual([[true, 'imperative-action']]);
    expect(updates).toEqual([]);
    expect(handle.isOpen).toBe(false);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  it('follows v-model:open', async () => {
    const open = shallowRef(false);
    await render(() => (
      <Popover.Root
        open={open.value}
        {...{
          'onUpdate:open': (value: boolean) => {
            open.value = value;
          },
        }}
      >
        <Popover.Trigger>Open</Popover.Trigger>
      </Popover.Root>
    ));
    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    open.value = true;
    await flushMicrotasks();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('data-popup-open');

    open.value = false;
    await flushMicrotasks();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('data-popup-open');
  });

  it('closes with Escape and reports the active trigger', async () => {
    const details: Popover.Root.ChangeEventDetails[] = [];
    const { user } = await render(
      <Popover.Root
        defaultOpen
        defaultTriggerId="trigger"
        onOpenChange={(_open, eventDetails) => details.push(eventDetails)}
      >
        <Popover.Trigger id="trigger">Open</Popover.Trigger>
      </Popover.Root>,
    );
    const trigger = screen.getByRole('button');

    await user.keyboard('[Escape]');

    expect(details).toHaveLength(1);
    expect(details[0].reason).toBe('escape-key');
    expect(details[0].trigger).toBe(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it.each<{
    name: string;
    modal: boolean | 'trap-focus';
    closesOnPointerdown: boolean;
    event: string;
  }>([
    {
      name: 'closes on the click of an outside press',
      modal: false,
      closesOnPointerdown: false,
      event: 'click',
    },
    {
      name: 'closes on the pointerdown, trap-focus',
      modal: 'trap-focus',
      closesOnPointerdown: true,
      event: 'pointerdown',
    },
  ])('$name', async ({ modal, closesOnPointerdown, event }) => {
    const details: Popover.Root.ChangeEventDetails[] = [];
    await render(
      <div>
        <button data-testid="outside" />
        <Popover.Root
          defaultOpen
          defaultTriggerId="trigger"
          modal={modal}
          onOpenChange={(_open, eventDetails) => details.push(eventDetails)}
        >
          <Popover.Trigger id="trigger">Open</Popover.Trigger>
        </Popover.Root>
      </div>,
    );
    const outside = screen.getByTestId('outside');
    const trigger = screen.getByRole('button', { name: 'Open' });

    await fireEvent.pointerDown(outside, { pointerType: 'mouse', button: 0 });
    expect(trigger).toHaveAttribute('aria-expanded', closesOnPointerdown ? 'false' : 'true');

    await fireEvent.mouseDown(outside);
    await fireEvent.pointerUp(outside, { pointerType: 'mouse' });
    await fireEvent.mouseUp(outside);
    await fireEvent.click(outside, { detail: 1 });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(details.map((item) => [item.reason, item.event.type])).toEqual([
      ['outside-press', event],
    ]);
  });

  it('BUG-5410: a press in a same-origin frame closes a popover that is not modal', async () => {
    const changes: Change[] = [];
    await render(
      <div>
        <iframe data-testid="frame" srcdoc="<button id='inside'>in the frame</button>" />
        <Popover.Root defaultOpen defaultTriggerId="trigger" onOpenChange={recordChange(changes)}>
          <Popover.Trigger id="trigger">Open</Popover.Trigger>
        </Popover.Root>
      </div>,
    );
    const frame = screen.getByTestId<HTMLIFrameElement>('frame');
    await waitFor(() => {
      expect(frame.contentDocument?.getElementById('inside')).not.toBe(null);
    });
    await flushMicrotasks();
    const button = frame.contentDocument!.getElementById('inside')!;
    const frameWindow = frame.contentWindow as Window & typeof globalThis;

    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      const EventType = type.startsWith('pointer')
        ? frameWindow.PointerEvent
        : frameWindow.MouseEvent;
      button.dispatchEvent(
        new EventType(type, { bubbles: true, cancelable: true, composed: true, detail: 1 }),
      );
    }
    await flushMicrotasks();

    expect(changes).toEqual([[false, 'outside-press']]);
    expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('gives the payload of the active trigger to the default slot', async () => {
    const handle = Popover.createHandle<string>();
    await render(
      <Popover.Root
        handle={handle}
        v-slots={{
          default: ({ payload }: { payload: string | undefined }) => (
            <>
              <p data-testid="payload">{payload ?? 'none'}</p>
              <Popover.Trigger id="one" payload="first" />
              <Popover.Trigger id="two" payload="second" />
            </>
          ),
        }}
      />,
    );
    const payload = screen.getByTestId('payload');
    expect(payload).toHaveTextContent('none');

    handle.open('one');
    await flushMicrotasks();
    expect(payload).toHaveTextContent('first');

    handle.open('two');
    await flushMicrotasks();
    expect(payload).toHaveTextContent('second');
  });

  describe('handle', () => {
    it('opens and closes from the handle and reports isOpen', async () => {
      const handle = Popover.createHandle<unknown>();
      await render(
        <Popover.Root handle={handle}>
          <Popover.Trigger id="trigger">Open</Popover.Trigger>
        </Popover.Root>,
      );
      const trigger = screen.getByRole('button');
      expect(handle.isOpen).toBe(false);

      handle.open('trigger');
      await flushMicrotasks();
      expect(handle.isOpen).toBe(true);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      handle.close();
      await flushMicrotasks();
      expect(handle.isOpen).toBe(false);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('registers a trigger outside the root', async () => {
      const handle = Popover.createHandle<unknown>();
      await render(
        <>
          <Popover.Trigger id="before" handle={handle}>
            Before
          </Popover.Trigger>
          <Popover.Root handle={handle}>
            <Popover.Trigger id="inside">Inside</Popover.Trigger>
          </Popover.Root>
          <Popover.Trigger id="after" handle={handle}>
            After
          </Popover.Trigger>
        </>,
      );
      const before = screen.getByRole('button', { name: 'Before' });
      const inside = screen.getByRole('button', { name: 'Inside' });
      const after = screen.getByRole('button', { name: 'After' });

      handle.open('after');
      await flushMicrotasks();
      expect([before, inside, after].map((item) => item.getAttribute('aria-expanded'))).toEqual([
        'false',
        'false',
        'true',
      ]);

      handle.open('before');
      await flushMicrotasks();
      expect([before, inside, after].map((item) => item.getAttribute('aria-expanded'))).toEqual([
        'true',
        'false',
        'false',
      ]);
    });

    it('throws when open() names no registered trigger', async () => {
      const handle = Popover.createHandle<unknown>();
      await render(
        <Popover.Root handle={handle}>
          <Popover.Trigger id="trigger" />
        </Popover.Root>,
      );

      expect(() => handle.open('missing')).toThrow(/Vase UI: PopoverHandle\.open\(\)/);
    });
  });

  it('exposes close and unmount', async () => {
    const changes: Change[] = [];
    const root = createRootRef();
    await render(() => (
      <Popover.Root
        ref={root.ref}
        defaultOpen
        defaultTriggerId="trigger"
        onOpenChange={recordChange(changes)}
      >
        <Popover.Trigger id="trigger" />
      </Popover.Root>
    ));

    expect(Object.keys(root.current)).toEqual(['unmount', 'close']);

    root.current.close();
    await flushMicrotasks();

    expect(changes).toEqual([[false, 'imperative-action']]);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  it('emits openChangeComplete when unmount() ends the close', async () => {
    const completions: boolean[] = [];
    const root = createRootRef();
    await render(() => (
      <Popover.Root
        ref={root.ref}
        defaultOpen
        defaultTriggerId="trigger"
        onOpenChange={(_open, details) => details.preventUnmountOnClose()}
        onOpenChangeComplete={(open) => completions.push(open)}
      >
        <Popover.Trigger id="trigger" />
      </Popover.Root>
    ));

    root.current.close();
    await flushMicrotasks();
    expect(completions).toEqual([]);

    root.current.unmount();
    await flushMicrotasks();
    expect(completions).toEqual([false]);
  });

  it('gives the modal prop to the store', async () => {
    const handle = Popover.createHandle<unknown>();
    const modal = shallowRef<boolean | 'trap-focus'>('trap-focus');
    await render(() => (
      <Popover.Root handle={handle} modal={modal.value}>
        <Popover.Trigger />
      </Popover.Root>
    ));
    expect(handle.store.select('modal')).toBe('trap-focus');

    modal.value = true;
    await flushMicrotasks();

    expect(handle.store.select('modal')).toBe(true);
  });

  it('clears the interaction type of the open when the popover closes', async () => {
    const handle = Popover.createHandle<unknown>();
    const { user } = await render(
      <Popover.Root handle={handle}>
        <Popover.Trigger>Open</Popover.Trigger>
      </Popover.Root>,
    );
    const trigger = screen.getByRole('button');

    await fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
    await fireEvent.click(trigger, { detail: 1 });
    expect(handle.isOpen).toBe(true);
    expect(handle.store.state.openMethod).toBe('mouse');

    await user.keyboard('[Escape]');

    expect(handle.isOpen).toBe(false);
    expect(handle.store.state.openMethod).toBe(null);
  });

  describe('timer of a patient press', () => {
    async function renderOpenRoot() {
      const handle = Popover.createHandle<unknown>();
      const { unmount } = await render(
        <Popover.Root handle={handle} defaultOpen defaultTriggerId="trigger">
          <Popover.Trigger id="trigger" />
        </Popover.Root>,
      );
      const { stickIfOpenTimeout } = handle.store.context;
      onTestFinished(stickIfOpenTimeout.clear);
      stickIfOpenTimeout.start(60_000, () => {});
      expect(stickIfOpenTimeout.isStarted()).toBe(true);
      return { handle, stickIfOpenTimeout, unmount };
    }

    it('stops when the popover closes', async () => {
      const { handle, stickIfOpenTimeout } = await renderOpenRoot();

      handle.close();
      await flushMicrotasks();

      expect(stickIfOpenTimeout.isStarted()).toBe(false);
    });

    it('stops when the root unmounts', async () => {
      const { stickIfOpenTimeout, unmount } = await renderOpenRoot();

      unmount();

      expect(stickIfOpenTimeout.isStarted()).toBe(false);
    });
  });

  describe('tree', () => {
    it('starts a tree when no popover is above it', async () => {
      const { trees, report } = createTreeReports();
      await render(
        <div>
          <TreeProbe report={report('outside')} />
          <Popover.Root>
            <TreeProbe report={report('first')} />
          </Popover.Root>
          <Popover.Root>
            <TreeProbe report={report('second')} />
          </Popover.Root>
        </div>,
      );

      expect(trees.outside).toBe(null);
      expect(trees.first).not.toBe(null);
      expect(trees.second).not.toBe(null);
      expect(trees.first).not.toBe(trees.second);
    });

    it('joins the tree of the popover above it', async () => {
      const { trees, report } = createTreeReports();
      await render(
        <Popover.Root>
          <TreeProbe report={report('parent')} />
          <Popover.Root>
            <TreeProbe report={report('child')} />
          </Popover.Root>
        </Popover.Root>,
      );

      expect(trees.parent).not.toBe(null);
      expect(trees.child).toBe(trees.parent);
    });
  });

  it('VUE-5: keeps its open state under KeepAlive and hears no Escape while deactivated', async () => {
    const changes: Change[] = [];
    const Page = defineComponent({
      name: 'Page',
      setup() {
        return () => (
          <Popover.Root defaultOpen defaultTriggerId="trigger" onOpenChange={recordChange(changes)}>
            <Popover.Trigger id="trigger">Open</Popover.Trigger>
          </Popover.Root>
        );
      },
    });
    const visible = shallowRef(true);
    const { user } = await render(() => (
      <KeepAlive>{visible.value ? <Page key="page" /> : <p key="other">other</p>}</KeepAlive>
    ));
    const trigger = screen.getByRole('button');

    visible.value = false;
    await flushMicrotasks();
    await user.keyboard('[Escape]');
    expect(changes).toEqual([]);

    visible.value = true;
    await flushMicrotasks();
    expect(screen.getByRole('button')).toBe(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('[Escape]');
    expect(changes).toEqual([[false, 'escape-key']]);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  describe('hydration', () => {
    interface TriggerValues {
      expanded: string | null;
      controls: string | null;
      open: boolean;
    }

    // The triggers, in the order of the document.
    function readTriggers(root: ParentNode): TriggerValues[] {
      return Array.from(root.querySelectorAll('button'), (trigger) => ({
        expanded: trigger.getAttribute('aria-expanded'),
        controls: trigger.getAttribute('aria-controls'),
        open: trigger.hasAttribute('data-popup-open'),
      }));
    }

    const closed: TriggerValues = { expanded: 'false', controls: null, open: false };
    const open: TriggerValues = {
      expanded: 'true',
      controls: expect.stringMatching(/^vase-ui-/) as string,
      open: true,
    };

    // A server registers no trigger and attaches no store to a handle. Vue does not patch an
    // attribute of a bound object when it hydrates, so the first render of each trigger must have
    // the values of the server HTML.
    it.each<{
      name: string;
      props: Record<string, unknown>;
      server: TriggerValues[];
      client: TriggerValues[];
    }>([
      {
        name: 'closed',
        props: {},
        server: [closed],
        client: [closed],
      },
      {
        name: 'open with defaultTriggerId',
        props: { defaultOpen: true, defaultTriggerId: 'inside' },
        server: [open],
        client: [open],
      },
      {
        name: 'a trigger with a handle',
        props: { defaultOpen: true, defaultTriggerId: 'detached', detached: true },
        server: [closed, closed],
        client: [open, closed],
      },
    ])('hydrates the server HTML of a root: $name', async ({ props, server, client }) => {
      const serverHtml = await renderOnServer(HYDRATION_FILE, props);
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      expect(readTriggers(template.content)).toEqual(server);

      const { container } = await hydrate(PopoverRootHydration, { serverHtml, props });

      expect(readTriggers(container)).toEqual(client);
    });
  });
});
