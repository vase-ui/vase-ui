import { describe, expect, it } from 'vitest';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createPopupFixtureHandle } from '../../../test/fixtures/PopupFixture';
import { ValuePopupFixtureStore } from '../../../test/fixtures/ValuePopupFixture';
import { useSingleAnchorPopupRoot } from './popupRoot';
import PopupRootHydration from './PopupRootHydration.test.vue';

interface TriggerValues {
  expanded: string | undefined;
  controls: string | undefined;
  open: boolean;
}

// The triggers, in the order of the document.
function readTriggers(html: string): TriggerValues[] {
  return Array.from(html.matchAll(/<button\b[^>]*>/g), ([tag]) => ({
    expanded: / aria-expanded="([^"]*)"/.exec(tag)?.[1],
    controls: / aria-controls="([^"]*)"/.exec(tag)?.[1],
    open: tag.includes(' data-popup-open'),
  }));
}

function renderRoot(props: Record<string, unknown> = {}) {
  return renderToString(createSSRApp(PopupRootHydration, props));
}

const closed: TriggerValues = { expanded: 'false', controls: undefined, open: false };
const open: TriggerValues = {
  expanded: 'true',
  controls: expect.stringMatching(/^vase-ui-/) as string,
  open: true,
};

describe('usePopupRoot on a server', () => {
  // A server calls no ref callback, no `onMounted` hook and no `onBeforeMount` hook. It registers
  // no trigger, and no root attaches its store to a handle.
  it.each<{ name: string; props: Record<string, unknown>; triggers: TriggerValues[] }>([
    {
      name: 'closed with a trigger id',
      props: { defaultTriggerId: 'first', triggers: ['first', 'second'] },
      triggers: [closed, closed],
    },
    {
      name: 'open with defaultTriggerId',
      props: { defaultOpen: true, defaultTriggerId: 'first', triggers: ['first', 'second'] },
      triggers: [open, closed],
    },
    {
      name: 'open with the triggerId prop',
      props: { open: true, triggerId: 'second', triggers: ['first', 'second'] },
      triggers: [closed, open],
    },
    {
      name: 'one trigger, no trigger id',
      props: { defaultOpen: true, triggers: ['first'] },
      triggers: [closed],
    },
    {
      name: 'two triggers, no trigger id',
      props: { defaultOpen: true, triggers: ['first', 'second'] },
      triggers: [closed, closed],
    },
    {
      name: 'a trigger with a handle that opens',
      props: {
        defaultOpen: true,
        defaultTriggerId: 'after',
        triggers: ['first'],
        detachedBefore: 'before',
        detachedAfter: 'after',
      },
      triggers: [closed, closed, closed],
    },
  ])('writes the attributes of each trigger: $name', async ({ props, triggers }) => {
    expect(readTriggers(await renderRoot(props))).toEqual(triggers);
  });

  it('writes no popup, also for a popup that stays mounted', async () => {
    const context: { teleports?: Record<string, string> } = {};
    const html = await renderToString(
      createSSRApp(PopupRootHydration, {
        defaultOpen: true,
        defaultTriggerId: 'first',
        keepMounted: true,
      }),
      context,
    );

    expect(html).not.toContain('role="dialog"');
    expect(context.teleports).toBeUndefined();
  });

  it('gives a trigger the generated id of a popup that has an id of its own', async () => {
    const props = { defaultOpen: true, defaultTriggerId: 'first' };

    // The portal renders the popup after the mount, so a server never reads the id of the popup.
    const html = await renderRoot({ ...props, popupId: 'my-popup' });

    expect(readTriggers(html)).toEqual([open]);
    expect(html).toBe(await renderRoot(props));
    expect(html).not.toContain('my-popup');
  });

  it('leaves the handle of a module inert when two renders in one process use it', async () => {
    const handle = createPopupFixtureHandle<unknown>();
    const openProps = {
      defaultOpen: true,
      defaultTriggerId: 'detached',
      detachedAfter: 'detached',
    };
    const closedProps = { detachedAfter: 'detached' };

    const [opened, unopened] = await Promise.all([
      renderRoot({ handle, ...openProps }),
      renderRoot({ handle, ...closedProps }),
    ]);

    expect(opened).toBe(await renderRoot(openProps));
    expect(unopened).toBe(await renderRoot(closedProps));
    expect(handle.store).toBe(handle.serverStore);
    expect(handle.isOpen).toBe(false);
    expect(handle.serverStore.context.triggerElements.size).toBe(0);
  });
});

describe('useSingleAnchorPopupRoot on a server', () => {
  it('renders an open root on a server', async () => {
    let store: ValuePopupFixtureStore | undefined;
    const Root = defineComponent({
      setup() {
        const root = useSingleAnchorPopupRoot(
          { defaultOpen: true },
          (initialState, defaultPopupId) =>
            new ValuePopupFixtureStore(initialState, defaultPopupId),
          { name: 'Root', onOpenChange() {}, onOpenChangeComplete() {} },
        );
        store = root.store;
        return () => (root.mounted.value ? h('div', { role: 'dialog' }, 'popup') : null);
      },
    });

    const html = await renderToString(createSSRApp(Root));

    expect(html).toBe('<div role="dialog">popup</div>');
    expect(store?.state.mounted).toBe(true);
  });
});
