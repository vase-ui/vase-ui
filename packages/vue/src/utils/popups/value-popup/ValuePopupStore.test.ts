import { describe, expect, it, onTestFinished } from 'vitest';
import { defineComponent, h, nextTick, watch } from 'vue';
import { createRenderer } from '#test-utils';
import { ValuePopupFixtureStore } from '../../../../test/fixtures/ValuePopupFixture';

function createAnchors() {
  return {
    trigger: document.createElement('button'),
    other: document.createElement('div'),
  };
}

describe('ValuePopupStore', () => {
  const { render } = createRenderer();

  it('writes the anchor of the family to anchorElement in the write that changes it', () => {
    const store = new ValuePopupFixtureStore();
    const { trigger } = createAnchors();
    expect(store.state.anchorElement).toBe(null);

    store.set('triggerElement', trigger);

    expect(store.state.anchorElement).toBe(trigger);
  });

  it('puts the anchor back when the open state changes', () => {
    const store = new ValuePopupFixtureStore();
    const { trigger, other } = createAnchors();
    store.set('triggerElement', trigger);
    store.set('anchorElement', other);
    expect(store.state.anchorElement).toBe(other);

    store.set('open', true);
    expect(store.state.anchorElement).toBe(trigger);

    // A controlled root changes the open state with `openProp`, and `open` keeps the last request.
    store.set('anchorElement', other);
    store.set('openProp', false);
    expect(store.state.open).toBe(true);
    expect(store.state.anchorElement).toBe(trigger);
  });

  it('puts the anchor back when the positioner element changes', () => {
    const store = new ValuePopupFixtureStore();
    const { trigger, other } = createAnchors();
    store.set('triggerElement', trigger);
    store.set('anchorElement', other);
    expect(store.state.anchorElement).toBe(other);

    store.set('positionerElement', document.createElement('div'));

    expect(store.state.anchorElement).toBe(trigger);
  });

  it('keeps another anchorElement until one of the three changes', () => {
    const store = new ValuePopupFixtureStore();
    const { trigger, other } = createAnchors();
    store.set('triggerElement', trigger);
    store.set('anchorElement', other);

    store.update({ activeIndex: 1, popupSide: 'top', selectedValue: 'a' });

    expect(store.state.anchorElement).toBe(other);
  });

  it('does not anchor to the active trigger', () => {
    const store = new ValuePopupFixtureStore();
    const { trigger, other } = createAnchors();
    store.set('triggerElement', trigger);

    // The base store anchors a mounted popup to its active trigger.
    store.update({ mounted: true, activeTriggerId: 'active', activeTriggerElement: other });

    expect(store.state.anchorElement).toBe(trigger);
  });

  it('gives anchorOverride before anchorElement, also while the popup is not mounted', () => {
    const store = new ValuePopupFixtureStore();
    const { trigger } = createAnchors();
    const override = { getBoundingClientRect: () => new DOMRect() };
    store.set('triggerElement', trigger);
    expect(store.state.mounted).toBe(false);
    expect(store.select('anchor')).toBe(trigger);

    store.set('anchorOverride', override);

    expect(store.select('anchor')).toBe(override);
  });

  it('writes open after the other keys', () => {
    const store = new ValuePopupFixtureStore();
    const { trigger } = createAnchors();
    const anchorsAtOpenChange: (Element | null)[] = [];
    const stop = watch(
      () => store.select('open'),
      () => {
        anchorsAtOpenChange.push(store.state.anchorElement);
      },
      { flush: 'sync' },
    );
    onTestFinished(stop);

    store.update({ open: true, triggerElement: trigger });

    expect(anchorsAtOpenChange).toHaveLength(1);
    expect(anchorsAtOpenChange[0]).toBe(trigger);
  });

  // Vue calls a function ref during the render of the part. A read of the state in the callback
  // would make that render depend on the state. A trigger part sets the anchor in this way.
  it('adds no dependency to the render of a part when its ref callback sets the anchor of the family', async () => {
    const store = new ValuePopupFixtureStore();
    let renders = 0;
    const Part = defineComponent(() => () => {
      renders += 1;
      return h('button', {
        ref: (element) => store.set('triggerElement', element as HTMLElement | null),
      });
    });

    const { container } = await render(h(Part));
    expect(store.state.anchorElement).toBe(container.firstElementChild);
    expect(renders).toBe(1);

    store.set('positionerElement', document.createElement('div'));
    await nextTick();
    expect(renders).toBe(1);

    store.set('open', true);
    await nextTick();
    expect(renders).toBe(1);
  });
});
