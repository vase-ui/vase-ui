import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { computed } from 'vue';
import { createMenubarContext } from '../../../test/fixtures/MenuParentFixture';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { MenuStore, createNullMenuStore } from './MenuStore';

function createMountedMenuStore() {
  const store = new MenuStore();
  store.context.getCommittedOpenState = () => ({
    open: store.select('open'),
    activeTriggerElement: store.select('activeTriggerElement'),
    openChangeReason: store.state.openChangeReason,
  });
  return store;
}

describe('MenuStore', () => {
  describe('openEvent', () => {
    it('keeps the event of a click open when a hover open follows', () => {
      const store = createMountedMenuStore();
      const mousedown = new MouseEvent('mousedown');

      store.setOpen(true, createChangeEventDetails(REASONS.triggerPress, mousedown));
      expect(store.context.openEvent).toBe(mousedown);

      store.setOpen(
        true,
        createChangeEventDetails(REASONS.triggerHover, new MouseEvent('mouseenter')),
      );

      expect(store.context.openEvent).toBe(mousedown);
    });

    it('clears the event when the menu closes', () => {
      const store = createMountedMenuStore();

      store.setOpen(
        true,
        createChangeEventDetails(REASONS.triggerPress, new MouseEvent('mousedown')),
      );
      store.setOpen(
        false,
        createChangeEventDetails(REASONS.escapeKey, new KeyboardEvent('keydown')),
      );

      expect(store.context.openEvent).toBe(undefined);
    });
  });

  describe('lastOpenChangeEvent', () => {
    it('records the event of the latest open change', () => {
      const store = createMountedMenuStore();
      const mouseenter = new MouseEvent('mouseenter');

      store.setOpen(
        true,
        createChangeEventDetails(REASONS.triggerPress, new MouseEvent('mousedown')),
      );
      store.setOpen(true, createChangeEventDetails(REASONS.triggerHover, mouseenter));

      expect(store.context.lastOpenChangeEvent).toBe(mouseenter);
    });
  });
});

describe('MenuStore (Vase UI)', () => {
  it('drops each open change while no root is mounted', () => {
    const store = new MenuStore();
    const onOpenChange = vi.fn();
    store.context.onOpenChange = onOpenChange;

    store.setOpen(true, createChangeEventDetails(REASONS.imperativeAction));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(store.state.open).toBe(false);
  });

  it('drops a touch click that follows an open on focus', () => {
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const store = createMountedMenuStore();
    const touchClick = () => new PointerEvent('click', { pointerType: 'touch' });

    store.setOpen(true, createChangeEventDetails(REASONS.triggerFocus, new FocusEvent('focus')));
    store.setOpen(false, createChangeEventDetails(REASONS.triggerPress, touchClick()));

    expect(store.state.open).toBe(true);

    vi.advanceTimersByTime(300);
    store.setOpen(false, createChangeEventDetails(REASONS.triggerPress, touchClick()));

    expect(store.state.open).toBe(false);
  });

  it.each<{
    name: string;
    menubar?: boolean;
    closing?: boolean;
    details: () => Parameters<MenuStore<unknown>['setOpen']>[1];
    instantType: 'dismiss' | 'click' | 'group' | undefined;
    keyboardOpen: boolean;
  }>([
    {
      name: 'a keyboard click',
      details: () =>
        createChangeEventDetails(REASONS.triggerPress, new MouseEvent('click', { detail: 0 })),
      instantType: 'click',
      keyboardOpen: true,
    },
    {
      name: 'a mouse click',
      details: () =>
        createChangeEventDetails(REASONS.triggerPress, new MouseEvent('click', { detail: 1 })),
      instantType: undefined,
      keyboardOpen: false,
    },
    {
      name: 'Escape',
      closing: true,
      details: () => createChangeEventDetails(REASONS.escapeKey, new KeyboardEvent('keydown')),
      instantType: 'dismiss',
      keyboardOpen: false,
    },
    {
      name: 'an arrow key',
      details: () => createChangeEventDetails(REASONS.listNavigation, new KeyboardEvent('keydown')),
      instantType: undefined,
      keyboardOpen: true,
    },
    {
      name: 'a hover in a menubar',
      menubar: true,
      details: () => createChangeEventDetails(REASONS.triggerHover, new MouseEvent('mouseenter')),
      instantType: 'group',
      keyboardOpen: false,
    },
    {
      name: 'a hover outside a menubar',
      details: () => createChangeEventDetails(REASONS.triggerHover, new MouseEvent('mouseenter')),
      instantType: undefined,
      keyboardOpen: false,
    },
  ])(
    'sets instantType and keyboardOpen for $name',
    ({ menubar, closing = false, details, instantType, keyboardOpen }) => {
      const store = createMountedMenuStore();
      if (menubar) {
        store.set('parent', { type: 'menubar', context: createMenubarContext() });
      }
      if (closing) {
        store.setOpen(true, createChangeEventDetails(REASONS.imperativeAction));
      }

      store.setOpen(!closing, details());

      expect(store.state.instantType).toBe(instantType);
      expect(store.state.keyboardOpen).toBe(keyboardOpen);
    },
  );

  it('reads the id, the tree and the key relay of its parent menu', () => {
    const parent = new MenuStore<unknown>({ rootId: 'parent-id' });
    const child = new MenuStore<unknown>({ parent: { type: 'menu', store: parent } });
    const relay = computed(() => child.select('keyboardEventRelay'));

    expect(child.select('rootId')).toBe('parent-id');
    expect(child.select('floatingTreeRoot')).toBe(parent.state.floatingTreeRoot);
    expect(child.select('modal')).toBe(false);
    expect(relay.value).toBe(undefined);

    const parentRelay = () => {};
    parent.set('keyboardEventRelay', parentRelay);

    expect(relay.value).toBe(parentRelay);
  });

  it('shares the mouse-up ref of a parent that a write gives', () => {
    const store = new MenuStore<unknown>();
    const context = createMenubarContext();

    store.set('parent', { type: 'menubar', context });

    expect(store.context.allowMouseUpTriggerRef).toBe(context.allowMouseUpTriggerRef);
  });

  it('tags a highlight with its reason, and a write back with none', () => {
    const store = new MenuStore<unknown>();
    const [first, second] = [document.createElement('div'), document.createElement('div')];
    store.context.itemDomElements.value = [first, second];
    store.context.reportedItem = second;
    const event = new KeyboardEvent('keydown');

    store.setActiveIndex(0, 'keyboard', event);

    expect(store.context.highlightReason).toBe('keyboard');
    expect(store.context.highlightEvent).toBe(event);

    store.setActiveIndex(1, 'pointer', new MouseEvent('mousemove'));

    expect(store.context.highlightReason).toBe('none');
    expect(store.context.highlightEvent).toBe(undefined);

    store.context.highlightReason = 'keyboard';
    store.setActiveIndex(1, 'pointer');

    expect(store.context.highlightReason).toBe('keyboard');
  });

  it('highlightItem finds the index of an element', () => {
    const store = new MenuStore<unknown>();
    const [first, second] = [document.createElement('div'), document.createElement('div')];
    store.context.itemDomElements.value = [first, second];

    store.highlightItem(second, 'pointer');

    expect(store.state.activeIndex).toBe(1);
    expect(store.context.highlightReason).toBe('pointer');

    store.highlightItem(document.createElement('div'), 'keyboard');

    expect(store.state.activeIndex).toBe(1);
  });

  it('the store of a handle with no root takes no write', () => {
    const store = createNullMenuStore();

    store.set('open', true);
    store.setOpen(true, createChangeEventDetails(REASONS.imperativeAction));

    expect(store.state.open).toBe(false);
    expect(Object.isFrozen(store.state)).toBe(true);
    expect(Object.isFrozen(store.context)).toBe(true);
  });
});
