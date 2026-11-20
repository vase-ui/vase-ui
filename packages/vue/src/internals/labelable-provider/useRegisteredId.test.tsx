import { describe, expect, it } from 'vitest';
import { KeepAlive, defineComponent, h, shallowRef } from 'vue';
import type { Ref, VNode } from 'vue';
import type { HTMLProps } from '@vase-ui/vue/types';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';
import { createIdRegistry } from './createIdRegistry';
import { useRegisteredId } from './useRegisteredId';

interface SlotProps {
  props: HTMLProps;
}

describe('useRegisteredId', () => {
  const { render } = createRenderer();

  describe('the id of the element', () => {
    function setup(getId: () => string | undefined = () => 'bound') {
      const { ids, registerId } = createIdRegistry();
      const slotId = shallowRef<string | undefined>('first');
      const shown = shallowRef(true);
      const beforeMount: string[][] = [];
      const Part = defineComponent(() => {
        const element = shallowRef<HTMLElement | null>(null);
        useRegisteredId(getId, registerId, element);
        beforeMount.push([...ids.value]);
        return () => (shown.value ? <div ref={element} id={slotId.value} /> : null);
      });
      return { Part, beforeMount, ids, shown, slotId };
    }

    it('gives the id of the part before the mount, and the id of the element from the mount on', async () => {
      const { Part, beforeMount, ids } = setup();

      await render(<Part />);

      expect(beforeMount).toEqual([['bound']]);
      expect(ids.value).toEqual(['first']);
    });

    it('follows each change of the id of the element', async () => {
      const { Part, ids, slotId } = setup();
      await render(<Part />);

      slotId.value = 'second';
      await flushMicrotasks();

      expect(ids.value).toEqual(['second']);
    });

    it.each([
      { name: 'an empty id', id: '' },
      { name: 'no id', id: undefined },
    ])('gives no id while the element has $name', async ({ id }) => {
      const { Part, ids, slotId } = setup();
      await render(<Part />);

      slotId.value = id;
      await flushMicrotasks();

      expect(ids.value).toEqual([]);
    });

    it('gives no id while the part has no element', async () => {
      const { Part, ids, shown } = setup();
      await render(<Part />);

      shown.value = false;
      await flushMicrotasks();

      expect(ids.value).toEqual([]);
    });

    it('gives no id while the part has no id, also with an element that has one', async () => {
      const hasId = shallowRef(true);
      const { Part, ids } = setup(() => (hasId.value ? 'bound' : undefined));
      await render(<Part />);

      hasId.value = false;
      await flushMicrotasks();

      expect(ids.value).toEqual([]);
    });

    it('gives no id while KeepAlive holds the part', async () => {
      const { Part, ids } = setup();
      const active = shallowRef(true);
      await render(() => <KeepAlive>{active.value ? <Part /> : null}</KeepAlive>);

      active.value = false;
      await flushMicrotasks();
      const held = [...ids.value];
      active.value = true;
      await flushMicrotasks();

      expect(held).toEqual([]);
      expect(ids.value).toEqual(['first']);
    });
  });

  it('does not render a reader again at the mount while the element has the id of the part', async () => {
    const { ids, registerId } = createIdRegistry();
    let renders = 0;
    const Part = defineComponent(() => {
      const element = shallowRef<HTMLElement | null>(null);
      useRegisteredId(() => 'bound', registerId, element);
      return () => <div ref={element} id="bound" />;
    });
    const Reader = defineComponent(() => () => {
      renders += 1;
      return <output>{ids.value.join(' ')}</output>;
    });

    await render(() => (
      <>
        <Part />
        <Reader />
      </>
    ));
    await flushMicrotasks();

    expect(renders).toBe(1);
  });
});
