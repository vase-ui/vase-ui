import { describe, expect, it } from 'vitest';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createPopoverHandle } from '../store/PopoverHandle';
import PopoverRootHydration from './PopoverRootHydration.test.vue';

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
  return renderToString(createSSRApp(PopoverRootHydration, props));
}

const closed: TriggerValues = { expanded: 'false', controls: undefined, open: false };
const open: TriggerValues = {
  expanded: 'true',
  controls: expect.stringMatching(/^vase-ui-/) as string,
  open: true,
};

describe('<Popover.Root /> on a server', () => {
  it('writes the attributes of a dialog trigger for a closed root', async () => {
    const [tag] = /<button\b[^>]*>/.exec(await renderRoot())!;

    expect(tag).toBe(
      '<button type="button" tabindex="0" data-vase-ui-click-trigger id="inside" aria-haspopup="dialog" aria-expanded="false">',
    );
  });

  it('writes the open attributes for a root with defaultTriggerId', async () => {
    const html = await renderRoot({ defaultOpen: true, defaultTriggerId: 'inside' });
    const [tag] = /<button\b[^>]*>/.exec(html)!;
    const [, controls] = / aria-controls="([^"]*)"/.exec(tag)!;

    // The generated id of the popup has the count of the earlier ids, so the test reads it.
    expect(controls).toMatch(/^vase-ui-/);
    expect(tag).toBe(
      `<button data-popup-open type="button" tabindex="0" data-vase-ui-click-trigger id="inside" aria-haspopup="dialog" aria-expanded="true" aria-controls="${controls}">`,
    );
  });

  it.each<{ name: string; props: Record<string, unknown>; triggers: TriggerValues[] }>([
    {
      name: 'open, no trigger id',
      props: { defaultOpen: true },
      triggers: [closed],
    },
    {
      name: 'open, a trigger with a handle',
      props: { defaultOpen: true, defaultTriggerId: 'detached', detached: true },
      triggers: [closed, closed],
    },
    {
      name: 'open, the trigger of the root',
      props: { defaultOpen: true, defaultTriggerId: 'inside', detached: true },
      triggers: [closed, open],
    },
  ])('writes the attributes of each trigger: $name', async ({ props, triggers }) => {
    expect(readTriggers(await renderRoot(props))).toEqual(triggers);
  });

  it('writes one comment in the place of the portal of an open root', async () => {
    const html = await renderRoot({ defaultOpen: true, defaultTriggerId: 'inside' });

    expect(html).toMatch(/<\/button><!---->/);
    expect(html).not.toContain('role=');
  });

  it('leaves the handle inert after a render of an open root', async () => {
    const handle = createPopoverHandle<unknown>();

    await renderRoot({
      handle,
      detached: true,
      defaultOpen: true,
      defaultTriggerId: 'detached',
    });

    expect(handle.store).toBe(handle.serverStore);
    expect(handle.isOpen).toBe(false);
  });
});
