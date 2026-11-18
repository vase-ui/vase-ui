import { describe, expect, it } from 'vitest';
import { FloatingRootStore } from '../floating-root/FloatingRootStore';
import { PopupTriggerMap } from '../popupTriggerMap';
import { hoverPointerStyle } from './hoverPointerEvents';
import { getHoverIntent } from './hoverIntent';
import type { HoverIntent } from './hoverIntent';

function createIntent() {
  const store = new FloatingRootStore({
    open: true,
    anchorElement: null,
    positionerElement: null,
    triggerElements: new PopupTriggerMap(),
    defaultPopupId: undefined,
    nested: false,
    onOpenChange: undefined,
  });
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
