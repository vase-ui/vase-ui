import { describe, expect, it } from 'vitest';
import { createSlotHost } from '../../../test/fixtures/slotHost';
import { tooltipTriggers } from './registeredParts';
import { isEventTargetWithin, isTargetInsideEnabledTrigger } from './element';
import { PopupTriggerMap } from './usePopupRoot';

describe('isEventTargetWithin', () => {
  it('treats a shadow-contained target as within when the event lacks composedPath', () => {
    const parent = document.createElement('div');
    const host = document.createElement('span');
    parent.appendChild(host);
    const inner = document.createElement('button');
    host.attachShadow({ mode: 'open' }).appendChild(inner);

    expect(parent.contains(inner)).toBe(false);

    const eventWithoutComposedPath = { target: inner } as unknown as Event;
    expect(isEventTargetWithin(eventWithoutComposedPath, parent)).toBe(true);
  });

  it('returns false for an outside target when the event lacks composedPath', () => {
    const parent = document.createElement('div');
    const outside = document.createElement('button');

    const eventWithoutComposedPath = { target: outside } as unknown as Event;
    expect(isEventTargetWithin(eventWithoutComposedPath, parent)).toBe(false);
  });

  it('returns true for a light-DOM child when the event lacks composedPath', () => {
    const parent = document.createElement('div');
    const child = document.createElement('button');
    parent.appendChild(child);

    const eventWithoutComposedPath = { target: child } as unknown as Event;
    expect(isEventTargetWithin(eventWithoutComposedPath, parent)).toBe(true);
  });

  it('checks the event target when composedPath and getRootNode are unavailable', () => {
    const parent = document.createElement('div');
    const child = document.createElement('button');
    Object.defineProperty(parent, 'getRootNode', { value: undefined });
    Object.defineProperty(child, 'getRootNode', { value: undefined });
    const event = { target: child } as unknown as Event;

    parent.append(child);
    expect(isEventTargetWithin(event, parent)).toBe(true);
    child.remove();
    expect(isEventTargetWithin(event, parent)).toBe(false);
  });
});

function disable(trigger: Element) {
  tooltipTriggers.set(trigger, () => true);
}

describe('isTargetInsideEnabledTrigger', () => {
  it('VUE-138: recognizes a press on content assigned to the trigger slot', () => {
    const label = document.createElement('span');
    const root = createSlotHost(label);
    const trigger = document.createElement('button');
    trigger.append(document.createElement('slot'));
    root.append(trigger);
    const triggers = new PopupTriggerMap();
    triggers.add('trigger', trigger);

    expect(isTargetInsideEnabledTrigger(label, triggers)).toBe(true);
    disable(trigger);
    expect(isTargetInsideEnabledTrigger(label, triggers)).toBe(false);
  });

  it('returns true for an enabled trigger and for a target inside it', () => {
    const trigger = document.createElement('button');
    const target = document.createElement('span');
    trigger.appendChild(target);
    const triggerElements = new PopupTriggerMap();
    triggerElements.add('trigger', trigger);

    expect(isTargetInsideEnabledTrigger(trigger, triggerElements)).toBe(true);
    expect(isTargetInsideEnabledTrigger(target, triggerElements)).toBe(true);
  });

  it('returns false for a disabled trigger and for a target inside it', () => {
    const trigger = document.createElement('button');
    const target = document.createElement('span');
    trigger.appendChild(target);
    disable(trigger);
    const triggerElements = new PopupTriggerMap();
    triggerElements.add('trigger', trigger);

    expect(isTargetInsideEnabledTrigger(trigger, triggerElements)).toBe(false);
    expect(isTargetInsideEnabledTrigger(target, triggerElements)).toBe(false);
  });

  it('returns false for a target outside the triggers and for a target that is not an element', () => {
    const trigger = document.createElement('button');
    const text = document.createTextNode('text');
    trigger.appendChild(text);
    const triggerElements = new PopupTriggerMap();
    triggerElements.add('trigger', trigger);

    expect(isTargetInsideEnabledTrigger(document.createElement('span'), triggerElements)).toBe(
      false,
    );
    expect(isTargetInsideEnabledTrigger(text, triggerElements)).toBe(false);
    expect(isTargetInsideEnabledTrigger(null, triggerElements)).toBe(false);
  });

  it.each([
    { name: 'outer first, outer disabled', outerFirst: true, disabled: 'outer', expected: true },
    { name: 'outer first, inner disabled', outerFirst: true, disabled: 'inner', expected: false },
    { name: 'inner first, outer disabled', outerFirst: false, disabled: 'outer', expected: true },
    { name: 'inner first, inner disabled', outerFirst: false, disabled: 'inner', expected: false },
  ])('VUE-10: the innermost trigger decides when $name', ({ outerFirst, disabled, expected }) => {
    const outer = document.createElement('div');
    const inner = document.createElement('button');
    const target = document.createElement('span');
    outer.appendChild(inner);
    inner.appendChild(target);
    disable(disabled === 'outer' ? outer : inner);

    const triggerElements = new PopupTriggerMap();
    if (outerFirst) {
      triggerElements.add('outer', outer);
      triggerElements.add('inner', inner);
    } else {
      triggerElements.add('inner', inner);
      triggerElements.add('outer', outer);
    }

    expect(isTargetInsideEnabledTrigger(target, triggerElements)).toBe(expected);
  });
});
