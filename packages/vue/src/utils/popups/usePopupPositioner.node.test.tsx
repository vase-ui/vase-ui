import { describe, expect, it } from 'vitest';
import { defineComponent, provide } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { PopupFixtureContext, PopupFixtureStore } from '../../../test/fixtures/PopupFixture';
import PopupPositionerPart from '../../../test/fixtures/PopupPositionerPart.vue';
import { provideFloatingTree } from './tree/FloatingTree';
import { FloatingTreeStore } from './tree/FloatingTreeStore';

const BEFORE_POSITION =
  'position:fixed;top:0;left:0;--available-width:100vw;--available-height:100vh;opacity:0;';

// Renders a positioner in the state of a popup, and gives back what the render wrote.
async function renderPositioner(state: { open: boolean; mounted: boolean }, keepMounted: boolean) {
  const store = new PopupFixtureStore<unknown>(state);
  const tree = new FloatingTreeStore();
  const Root = defineComponent({
    setup() {
      provide(PopupFixtureContext, store);
      provideFloatingTree(tree);
      return () => <PopupPositionerPart keepMounted={keepMounted} />;
    },
  });

  const html = await renderToString(<Root />);
  return { html, store, tree };
}

describe('usePopupPositioner', () => {
  it('renders the positioner of an open popup on a server, and writes nothing to the store and the tree', async () => {
    const { html, store, tree } = await renderPositioner({ open: true, mounted: true }, false);

    expect(typeof document).toBe('undefined');
    expect(html).toBe(
      `<div data-open data-side="bottom" data-align="center" role="presentation" style="${BEFORE_POSITION}"><!--[--><!--]--></div>`,
    );
    expect(store.context.positioning).toBeUndefined();
    expect(store.state.positionerElement).toBe(null);
    expect(tree.nodesRef.value).toEqual([]);
  });

  it('renders the positioner of a kept popup that is closed as hidden, and as inert', async () => {
    const { html } = await renderPositioner({ open: false, mounted: false }, true);

    expect(html).toBe(
      `<div data-closed data-side="bottom" data-align="center" role="presentation" hidden style="${BEFORE_POSITION}pointer-events:none;"><!--[--><!--]--></div>`,
    );
  });

  it('renders the positioner of a popup that is closed and still mounted as not hidden, and as inert', async () => {
    const { html } = await renderPositioner({ open: false, mounted: true }, false);

    expect(html).toBe(
      `<div data-closed data-side="bottom" data-align="center" role="presentation" style="${BEFORE_POSITION}pointer-events:none;"><!--[--><!--]--></div>`,
    );
  });
});
