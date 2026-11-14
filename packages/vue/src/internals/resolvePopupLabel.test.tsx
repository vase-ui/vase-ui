import { describe, expect, it } from 'vitest';
import { resolvePopupLabel } from './resolvePopupLabel';

function createTrigger(id: string) {
  const trigger = document.createElement('button');
  trigger.id = id;
  return trigger;
}

describe('resolvePopupLabel', () => {
  it('falls back to the trigger id', () => {
    expect(resolvePopupLabel({}, null, 'trigger')).toBe('trigger');
  });

  it.each([
    { name: 'an aria-label', props: { 'aria-label': 'Commands' }, expected: undefined },
    { name: 'an aria-labelledby', props: { 'aria-labelledby': 'label' }, expected: 'label' },
    {
      name: 'both of them',
      props: { 'aria-label': 'Commands', 'aria-labelledby': 'label' },
      expected: 'label',
    },
  ])('does not use the trigger when the consumer gives $name', ({ props, expected }) => {
    expect(resolvePopupLabel(props, createTrigger('trigger'), 'registered')).toBe(expected);
  });

  it('uses the trigger when the aria-label is empty', () => {
    expect(resolvePopupLabel({ 'aria-label': '' }, null, 'trigger')).toBe('trigger');
  });

  it('prefers the live id of the trigger element over the registered id', () => {
    expect(resolvePopupLabel({}, createTrigger('live'), 'registered')).toBe('live');
  });

  it.each([
    { name: 'an element with no id', trigger: createTrigger(''), triggerId: 'registered' },
    { name: 'no trigger', trigger: null, triggerId: null },
  ])('gives no label for $name', ({ trigger, triggerId }) => {
    expect(resolvePopupLabel({}, trigger, triggerId)).toBe(undefined);
  });
});
