import { describe, expect, it } from 'vitest';
import { FloatingRootStore } from '../floating-root/FloatingRootStore';
import { PopupTriggerMap } from '../popupTriggerMap';
import { menuPopups } from '../registeredParts';
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
    elements.triggerElement.style.pointerEvents,
    elements.positionerElement.style.pointerEvents,
  ];
}

describe('HoverIntent', () => {
  describe('pointer events', () => {
    it('blocks the nearest menu popup after its slotted trigger moves', () => {
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

    describe('VUE-94: the hover triggers of the popup', () => {
      it('keep their pointer events while the popup blocks the scope element', () => {
        const elements = createElements();
        const intent = createIntent();
        const before = document.createElement('button');
        const after = document.createElement('button');
        intent.addHoverTrigger(before);
        expect(before.style.pointerEvents).toBe('');

        intent.blockOutsidePointerEvents(elements);
        intent.addHoverTrigger(after);
        expect([before.style.pointerEvents, after.style.pointerEvents]).toEqual(['auto', 'auto']);

        intent.removeHoverTrigger(after);
        expect(after.style.pointerEvents).toBe('');

        intent.restoreOutsidePointerEvents();
        expect(before.style.pointerEvents).toBe('');
      });

      it('keep a pointer-events value of their own', () => {
        const intent = createIntent();
        const trigger = document.createElement('button');
        trigger.style.pointerEvents = 'none';
        intent.addHoverTrigger(trigger);

        intent.blockOutsidePointerEvents(createElements());
        intent.restoreOutsidePointerEvents();

        expect(trigger.style.pointerEvents).toBe('none');
      });
    });
  });
});
