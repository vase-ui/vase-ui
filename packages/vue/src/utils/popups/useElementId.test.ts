import { describe, expect, it } from 'vitest';
import { effectScope, shallowRef } from 'vue';
import { flushMicrotasks } from '#test-utils';
import { useElementId } from './useElementId';

describe('useElementId', () => {
  function createElement(id: string) {
    const element = document.createElement('div');
    element.id = id;
    return element;
  }

  it('gives the id of the element, and no id while there is no element', () => {
    const element = shallowRef<Element | null>(null);
    const scope = effectScope();
    const id = scope.run(() => useElementId(element))!;
    expect(id.value).toBe(undefined);

    element.value = createElement('first');
    expect(id.value).toBe('first');

    element.value = null;
    expect(id.value).toBe(undefined);
    scope.stop();
  });

  it('follows a change of the id attribute', async () => {
    const target = createElement('first');
    const scope = effectScope();
    const id = scope.run(() => useElementId(shallowRef(target)))!;

    target.id = 'second';
    await flushMicrotasks();
    expect(id.value).toBe('second');

    target.removeAttribute('id');
    await flushMicrotasks();
    expect(id.value).toBe('');
    scope.stop();
  });

  it('follows the new element and stops following the element before', async () => {
    const before = createElement('before');
    const after = createElement('after');
    const element = shallowRef<Element | null>(before);
    const scope = effectScope();
    const id = scope.run(() => useElementId(element))!;

    element.value = after;
    before.id = 'before-changed';
    await flushMicrotasks();
    expect(id.value).toBe('after');

    after.id = 'after-changed';
    await flushMicrotasks();
    expect(id.value).toBe('after-changed');
    scope.stop();
  });

  it('stops following the element when its scope stops', async () => {
    const target = createElement('first');
    const scope = effectScope();
    const id = scope.run(() => useElementId(shallowRef(target)))!;

    scope.stop();
    target.id = 'second';
    await flushMicrotasks();

    expect(id.value).toBe('first');
  });
});
