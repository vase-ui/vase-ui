import { describe, expect, it } from 'vitest';
import { FloatingRootStore } from '../floating-root/FloatingRootStore';
import { PopupTriggerMap } from '../popupTriggerMap';
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
    elements.triggerElement.style.pointerEvents,
    elements.positionerElement.style.pointerEvents,
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
  });
});
