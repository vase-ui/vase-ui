import { describe, expect, it, onTestFinished } from 'vitest';
import { computed, createSSRApp, defineComponent, inject, reactive, shallowRef } from 'vue';
import type { PropType } from 'vue';
import type { VirtualElement } from '@floating-ui/vue';
import {
  createRenderer,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import { PopupFixtureContext } from '../../../test/fixtures/PopupFixture';
import type { PopupFixtureStore } from '../../../test/fixtures/PopupFixture';
import PopupPart from '../../../test/fixtures/PopupPart.vue';
import PopupPositionerPart from '../../../test/fixtures/PopupPositionerPart.vue';
import PopupRootPart from '../../../test/fixtures/PopupRootPart.vue';
import PopupTriggerPart from '../../../test/fixtures/PopupTriggerPart.vue';
import { adaptiveOrigin } from './positioning/adaptiveOriginMiddleware';
import { usePopupPositioner } from './popupPositioner';
import type { PopupPositionerState } from './popupPositioner';
import PopupPositionerHydration from './PopupPositionerHydration.test.vue';
import PopupPositionerReplace from './PopupPositionerReplace.test.vue';
import { provideFloatingTree } from './tree/FloatingTree';
import { FloatingTreeStore } from './tree/FloatingTreeStore';

type Place = { left: number; top: number };

const TRIGGER = { left: 200, top: 100, width: 40, height: 20 };
const POPUP = { width: 100, height: 50 };
const triggerStyle = {
  position: 'fixed',
  left: `${TRIGGER.left}px`,
  top: `${TRIGGER.top}px`,
  width: `${TRIGGER.width}px`,
  height: `${TRIGGER.height}px`,
} as const;
const popupProps = {
  positionMethod: 'fixed',
  'data-testid': 'popup',
  style: { width: `${POPUP.width}px`, height: `${POPUP.height}px` },
} as const;
// The place of the popup under the trigger, centered on it.
const BELOW: Place = {
  left: TRIGGER.left + TRIGGER.width / 2 - POPUP.width / 2,
  top: TRIGGER.top + TRIGGER.height,
};
// The place of the popup under a virtual anchor at 50 by 300 that has the size of the trigger.
const ANCHOR_OVERRIDE = new DOMRect(50, 300, TRIGGER.width, TRIGGER.height);
const BELOW_OVERRIDE: Place = {
  left: ANCHOR_OVERRIDE.x + TRIGGER.width / 2 - POPUP.width / 2,
  top: ANCHOR_OVERRIDE.y + TRIGGER.height,
};
const virtualElement: VirtualElement = { getBoundingClientRect: () => ANCHOR_OVERRIDE };
const BEFORE_POSITION = {
  position: 'fixed',
  top: '0px',
  left: '0px',
  opacity: '0',
  '--available-width': '100vw',
  '--available-height': '100vh',
};

interface RootInstance {
  store: PopupFixtureStore<unknown>;
}

/**
 * Renders the positioner and its popup when the popup is mounted, as the portal of a family does.
 * The popup gives the root the element whose animations end the close.
 */
const Positioned = defineComponent({
  props: { keepMounted: Boolean },
  setup(props) {
    const store = inject(PopupFixtureContext)!;
    const mounted = computed(() => store.select('mounted'));
    return () =>
      mounted.value || props.keepMounted ? (
        <PopupPositionerPart keepMounted={props.keepMounted}>
          <PopupPart keepMounted={props.keepMounted}>popup</PopupPart>
        </PopupPositionerPart>
      ) : null;
  },
});

const TreeScope = defineComponent({
  props: { tree: { type: Object as PropType<FloatingTreeStore>, required: true } },
  setup(props, { slots }) {
    provideFloatingTree(props.tree);
    return () => slots.default?.();
  },
});

async function waitForPlace(element: Element, expected: Place) {
  await waitFor(() => {
    const { left, top } = element.getBoundingClientRect();
    expect({ left, top }).toEqual(expected);
  });
}

describe('usePopupPositioner', () => {
  const { render } = createRenderer();

  // Renders a popup with one trigger. `open` is the open prop of the root.
  async function renderPopup(
    options: {
      open?: boolean;
      keepMounted?: boolean;
      triggerStyle?: Record<string, string>;
      positionerProps?: Record<string, unknown>;
    } = {},
  ) {
    const open = shallowRef(options.open ?? true);
    const root = shallowRef<RootInstance | null>(null);
    const tree = new FloatingTreeStore();
    await render(() => (
      <TreeScope tree={tree}>
        <PopupRootPart ref={root} open={open.value}>
          <PopupTriggerPart style={{ ...triggerStyle, ...options.triggerStyle }}>
            trigger
          </PopupTriggerPart>
          <Positioned
            {...popupProps}
            {...options.positionerProps}
            keepMounted={options.keepMounted}
          />
        </PopupRootPart>
      </TreeScope>
    ));
    return {
      open,
      tree,
      store: root.value!.store,
      trigger: screen.getByText('trigger'),
      popup: screen.getByTestId('popup'),
    };
  }

  it('positions the popup against the active trigger, and gives its element to the store', async () => {
    const { open, store, popup } = await renderPopup();

    await waitForPlace(popup, BELOW);
    expect(popup).toHaveAttribute('data-open');
    expect(popup).toHaveAttribute('data-side', 'bottom');
    expect(popup).toHaveAttribute('data-align', 'center');
    expect(popup).toHaveAttribute('role', 'presentation');
    expect(store.state.positionerElement).toBe(popup);

    open.value = false;

    await waitFor(() => {
      expect(screen.queryByTestId('popup')).toBe(null);
    });
    expect(store.state.positionerElement).toBe(null);
  });

  it('keeps the element of a positioner that mounts before the old positioner unmounts', async () => {
    const swapped = shallowRef(false);
    const root = shallowRef<RootInstance | null>(null);
    await render(() => (
      <PopupRootPart ref={root} open>
        <PopupPositionerReplace swapped={swapped.value} />
      </PopupRootPart>
    ));
    const store = root.value!.store;
    expect(store.state.positionerElement).toBe(screen.getByTestId('old'));

    swapped.value = true;
    await flushMicrotasks();

    expect(screen.queryByTestId('old')).toBe(null);
    expect(store.state.positionerElement).toBe(screen.getByTestId('new'));
  });

  it('follows the anchor override of the store', async () => {
    const { store, popup } = await renderPopup();
    await waitForPlace(popup, BELOW);

    store.set('anchorOverride', virtualElement);
    await waitForPlace(popup, BELOW_OVERRIDE);

    store.set('anchorOverride', null);
    await waitForPlace(popup, BELOW);
  });

  it('forgets the anchor override of a kept popup that closes', async () => {
    const { open, store, popup } = await renderPopup({ keepMounted: true });
    await waitForPlace(popup, BELOW);
    store.set('anchorOverride', virtualElement);
    await waitForPlace(popup, BELOW_OVERRIDE);

    open.value = false;

    await waitFor(() => {
      expect(store.state.anchorOverride).toBe(null);
    });

    open.value = true;

    await waitForPlace(popup, BELOW);
  });

  it('gives the instant type of the store to the state of the positioner', async () => {
    const { store, popup } = await renderPopup();
    expect(popup).not.toHaveAttribute('data-instant');

    store.set('instantType', 'dismiss');
    await flushMicrotasks();

    expect(popup).toHaveAttribute('data-instant', 'dismiss');
  });

  it('has no position and no reference while a kept popup is closed', async () => {
    const { open, store, popup } = await renderPopup({ keepMounted: true });
    await waitForPlace(popup, BELOW);

    open.value = false;

    await waitFor(() => {
      expect(popup).toHaveStyle({
        position: 'fixed',
        top: '0px',
        left: '0px',
        opacity: '0',
        transform: 'none',
      });
    });
    expect(store.context.positioning!.elements.reference).toBe(null);
  });

  it('hides a kept popup that is closed, and lets it ignore pointer events', async () => {
    const { open, popup } = await renderPopup({ open: false, keepMounted: true });

    expect(popup).toHaveAttribute('hidden');
    expect(popup).toHaveAttribute('data-closed');
    expect(popup).toHaveStyle({ pointerEvents: 'none' });

    open.value = true;

    await waitFor(() => {
      expect(popup.hidden).toBe(false);
    });
    expect(popup).toHaveAttribute('data-open');
    expect(popup.style.pointerEvents).toBe('');
  });

  it('disables the transition of the positioner while the popup starts', async () => {
    const { store, popup } = await renderPopup();
    await waitForPlace(popup, BELOW);
    expect(popup).toHaveStyle({ transitionProperty: 'all' });

    store.set('transitionStatus', 'starting');
    await flushMicrotasks();

    expect(popup).toHaveStyle({ transitionProperty: 'none' });
  });

  it('gives the adaptive origin of the store to the positioning', async () => {
    const { store, popup } = await renderPopup({
      positionerProps: {
        side: 'top',
        style: { width: `${POPUP.width}px`, height: `${POPUP.height}px`, transition: 'opacity 1s' },
      },
    });
    await waitFor(() => {
      expect(popup.getBoundingClientRect().top).toBe(TRIGGER.top - POPUP.height);
    });
    expect(popup.style.top).toBe('0px');

    store.set('adaptiveOrigin', adaptiveOrigin);

    // A popup that has a transition and is above its anchor has its place from the bottom edge of
    // the viewport. The place is a fraction of a pixel in some engines.
    await waitFor(() => {
      expect(popup.style.top).toBe('');
    });
    expect(popup.style.bottom).toMatch(/^\d+(\.\d+)?px$/);
    expect(popup.getBoundingClientRect().top).toBe(TRIGGER.top - POPUP.height);
  });

  it('uses the options of the part', async () => {
    const Positioner = defineComponent({
      setup() {
        const store = inject(PopupFixtureContext)!;
        const props = reactive({});
        const { elementProps } = usePopupPositioner<PopupPositionerState & { extra: string }>(
          store,
          props,
          {
            keepMounted: false,
            positioning: { side: () => 'top' },
            state: () => ({ extra: 'state' }),
            inert: () => true,
          },
        );
        return () => <div {...elementProps()} data-testid="popup" />;
      },
    });
    await render(
      <PopupRootPart open>
        <Positioner />
      </PopupRootPart>,
    );
    const popup = screen.getByTestId('popup');

    expect(popup).toHaveAttribute('data-side', 'top');
    expect(popup).toHaveAttribute('data-extra', 'state');
    expect(popup).toHaveStyle({ pointerEvents: 'none' });
  });

  it('gives the positioning context of the popup to the store and to the tree', async () => {
    const { store, tree, trigger, popup } = await renderPopup();
    await waitForPlace(popup, BELOW);

    const context = store.context.positioning!;

    expect(context.rootStore).toBe(store);
    expect(context.open).toBe(true);
    expect(context.placement).toBe('bottom');
    expect(context.elements).toEqual({
      reference: trigger,
      floating: popup,
      domReference: trigger,
    });
    expect(tree.nodesRef.value.map((node) => node.context)).toEqual([context]);
    expect(tree.nodesRef.value.map((node) => node.id)).toEqual([context.nodeId]);
  });

  it('gives the placement after a flip to the positioning context', async () => {
    // The popup has no room under a trigger at the bottom of the page, so it flips above.
    const { store, popup } = await renderPopup({
      triggerStyle: { top: `${window.innerHeight - TRIGGER.height - 4}px` },
    });

    await waitFor(() => {
      expect(popup).toHaveAttribute('data-side', 'top');
    });
    expect(store.context.positioning!.placement).toBe('top');
  });

  describe('hydration', () => {
    const file = 'src/utils/popups/PopupPositionerHydration.test.vue';

    it('hydrates a popup that is kept mounted and closed', async () => {
      const props = { open: false, keepMounted: true };
      const serverHtml = await renderOnServer(file, props);

      const { container } = await hydrate(PopupPositionerHydration, { serverHtml, props });

      const popup = container.querySelector('[data-testid="popup"]')!;
      expect(popup).toHaveStyle(BEFORE_POSITION);
      expect(popup).toHaveAttribute('hidden');
    });

    it('hydrates an open popup and then gives it a position', async () => {
      // The position comes after the two ticks of the `hydrate` helper, so the test hydrates by
      // hand and waits for the position.
      const props = { open: true };
      const container = document.createElement('div');
      document.body.append(container);
      container.innerHTML = await renderOnServer(file, props);
      const popup = container.querySelector('[data-testid="popup"]')!;
      expect(popup).toHaveStyle(BEFORE_POSITION);

      const app = createSSRApp(PopupPositionerHydration, props);
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });
      app.mount(container);

      await waitForPlace(popup, BELOW);
      // A mismatch makes Vue discard the server nodes and render new nodes.
      expect(container.querySelector('[data-testid="popup"]')).toBe(popup);
      expect(takeReportedMessages()).toEqual([]);
    });
  });
});
