import { describe, expect, it } from 'vitest';
import { shallowRef } from 'vue';
import { createElementSetter } from './createElementSetter';

describe('createElementSetter', () => {
  it('writes the element of its part, and clears it when its part goes away', () => {
    const target = shallowRef<HTMLElement | null>(null);
    const setter = createElementSetter(target);
    const element = document.createElement('div');

    setter(element);
    expect(target.value).toBe(element);

    setter(null);
    expect(target.value).toBe(null);
  });

  it('keeps the element of a part that replaced its part', () => {
    const target = shallowRef<HTMLElement | null>(null);
    const oldSetter = createElementSetter(target);
    const newSetter = createElementSetter(target);
    const oldElement = document.createElement('div');
    const newElement = document.createElement('div');
    oldSetter(oldElement);

    // A template can mount the new part before it unmounts the old part.
    newSetter(newElement);
    oldSetter(null);

    expect(target.value).toBe(newElement);
  });
});
