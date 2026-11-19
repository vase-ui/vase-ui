import { describe, expect, it } from 'vitest';
import { FloatingRootStore } from '../floating-root/FloatingRootStore';
import { PopupTriggerMap } from '../usePopupRoot';
import { menuPopups } from '../registeredParts';
import { hoverPointerStyle } from './hoverPointerEvents';
import { getHoverIntent } from './hoverIntent';
import type { HoverIntent } from './hoverIntent';

function createIntent(openEvent?: Event) {
  const store = new FloatingRootStore({
    open: true,
    anchorElement: null,
    positionerElement: null,
    triggerElements: new PopupTriggerMap(),
    defaultPopupId: undefined,
    nested: false,
    onOpenChange: undefined,
  });
  store.context.openEvent = openEvent;
  return getHoverIntent(store);
}

function createElements() {
  return {
    scopeElement: document.createElement('div'),
    triggerElement: document.createElement('button'),
    positionerElement: document.createElement('div'),
  };
}

function readPointerEvents(elements: ReturnType<typeof createElements>) {
  return [
    elements.scopeElement.style.pointerEvents,
    hoverPointerStyle(elements.triggerElement)?.pointerEvents ?? '',
    hoverPointerStyle(elements.positionerElement)?.pointerEvents ?? '',
  ];
}

describe('HoverIntent', () => {
  describe('pointer events', () => {
    it('VUE-138: blocks the nearest menu popup after its slotted trigger moves', () => {
      const { triggerElement, positionerElement, scopeElement: outer } = createElements();
      const inner = document.createElement('div');
      const host = document.createElement('div');
      host.attachShadow({ mode: 'open' }).append(inner);
      inner.append(document.createElement('slot'));
      host.append(triggerElement);
      outer.append(host, positionerElement);
      document.body.append(outer);
      menuPopups.set(outer, () => 'outer');
      menuPopups.set(inner, () => 'inner');
      const intent = createIntent(new MouseEvent('mouseenter'));
      intent.handleCloseOptions = { blockPointerEvents: true };
      try {
        intent.blockOutsidePointerEventsForPopup(triggerElement, positionerElement, null, null);
        expect(inner.style.pointerEvents).toBe('none');
        expect(outer.style.pointerEvents).toBe('');
        outer.append(triggerElement);
        intent.blockOutsidePointerEventsForPopup(triggerElement, positionerElement, null, null);
        expect(inner.style.pointerEvents).toBe('');
        expect(outer.style.pointerEvents).toBe('none');
      } finally {
        intent.restoreOutsidePointerEvents();
        outer.remove();
      }
    });

    it('blocks the scope element, and not the trigger and the positioner', () => {
      const elements = createElements();

      createIntent().blockOutsidePointerEvents(elements);

      expect(readPointerEvents(elements)).toEqual(['none', 'auto', 'auto']);
    });

    it.each([
      {
        name: 'restoreOutsidePointerEvents',
        restore: (intent: HoverIntent) => intent.restoreOutsidePointerEvents(),
      },
      { name: 'reset', restore: (intent: HoverIntent) => intent.reset() },
      { name: 'onPopupMouseEnter', restore: (intent: HoverIntent) => intent.onPopupMouseEnter() },
    ])('$name gives each element its value back', ({ restore }) => {
      const elements = createElements();
      const intent = createIntent();
      intent.blockOutsidePointerEvents(elements);

      restore(intent);

      expect(readPointerEvents(elements)).toEqual(['', '', '']);
    });

    it('lets one popup block a scope element, so a second popup takes it over', () => {
      const first = createElements();
      const second = { ...createElements(), scopeElement: first.scopeElement };
      const firstIntent = createIntent();
      const secondIntent = createIntent();
      firstIntent.blockOutsidePointerEvents(first);

      secondIntent.blockOutsidePointerEvents(second);

      expect(readPointerEvents(first)).toEqual(['none', '', '']);
      expect(readPointerEvents(second)).toEqual(['none', 'auto', 'auto']);

      firstIntent.restoreOutsidePointerEvents();
      expect(first.scopeElement.style.pointerEvents).toBe('none');

      secondIntent.restoreOutsidePointerEvents();
      expect(readPointerEvents(second)).toEqual(['', '', '']);
    });

    it('VUE-94: restores the value and priority of an external scope after a handoff', () => {
      const first = createElements();
      first.scopeElement.setAttribute('data-rootownerid', 'external');
      const second = { ...createElements(), scopeElement: first.scopeElement };
      const { style } = first.scopeElement;
      style.setProperty('pointer-events', 'all', 'important');
      const previous = createIntent();
      const current = createIntent();
      previous.blockOutsidePointerEvents(first);
      current.blockOutsidePointerEvents(second);
      previous.restoreOutsidePointerEvents();
      expect(style.pointerEvents).toBe('none');
      current.restoreOutsidePointerEvents();
      expect(style.pointerEvents).toBe('all');
      expect(style.getPropertyPriority('pointer-events')).toBe('important');
    });

    describe('VUE-94: the hover triggers of the popup', () => {
      it('keep their pointer events while the popup blocks the scope element', () => {
        const elements = createElements();
        const intent = createIntent();
        const before = document.createElement('button');
        const after = document.createElement('button');
        intent.addHoverTrigger(before);
        expect(hoverPointerStyle(before)).toBeUndefined();

        intent.blockOutsidePointerEvents(elements);
        intent.addHoverTrigger(after);
        expect([
          hoverPointerStyle(before)?.pointerEvents,
          hoverPointerStyle(after)?.pointerEvents,
        ]).toEqual(['auto', 'auto']);

        intent.removeHoverTrigger(after);
        expect(hoverPointerStyle(after)).toBeUndefined();

        intent.restoreOutsidePointerEvents();
        expect(hoverPointerStyle(before)).toBeUndefined();
      });
    });
  });
});
