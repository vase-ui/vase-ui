import { describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick, shallowRef } from 'vue';
import { createRenderer } from '#test-utils';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import type { VaseUIChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { provideFloatingNode } from '../tree/FloatingTree';
import { useFloatingRootStore } from './useFloatingRootStore';
import type { FloatingRootStore } from './FloatingRootStore';

describe('useFloatingRootStore', () => {
  const { render } = createRenderer();

  interface TestProps {
    open?: boolean | undefined;
    anchor?: Element | null | undefined;
    positionerElement?: HTMLElement | null | undefined;
    onOpenChange?:
      ((open: boolean, eventDetails: VaseUIChangeEventDetails<string>) => void) | undefined;
    onStore: (store: FloatingRootStore) => void;
  }

  const Test = defineComponent(
    (props: TestProps) => {
      const store = useFloatingRootStore({
        open: () => props.open,
        onOpenChange: (open, eventDetails) => props.onOpenChange?.(open, eventDetails),
        elements: {
          anchor: () => props.anchor,
          positionerElement: () => props.positionerElement,
        },
      });
      props.onStore(store);
      return () => null;
    },
    { props: ['open', 'anchor', 'positionerElement', 'onOpenChange', 'onStore'] },
  );

  async function renderStore(props: Omit<TestProps, 'onStore'> = {}) {
    let store!: FloatingRootStore;
    const view = await render(
      <Test
        {...props}
        onStore={(value) => {
          store = value;
        }}
      />,
    );
    return { ...view, store };
  }

  it('follows the anchor when it changes after the first render', async () => {
    const first = document.createElement('button');
    const second = document.createElement('button');
    let store: FloatingRootStore | undefined;
    const onStore = (value: FloatingRootStore) => {
      store = value;
    };

    const { setProps } = await render(<Test anchor={first} onStore={onStore} />);
    expect(store?.select('anchor')).toBe(first);

    await setProps({ anchor: second });

    expect(store?.select('anchor')).toBe(second);
    expect(store?.select('anchorElement')).toBe(second);
  });

  it('gives the store the values of its options at the first render', async () => {
    const anchor = document.createElement('button');
    const positionerElement = document.createElement('div');

    const { store } = await renderStore({ open: true, anchor, positionerElement });

    expect({
      open: store.select('open'),
      anchorElement: store.select('anchorElement'),
      positionerElement: store.select('positionerElement'),
      transitionStatus: store.select('transitionStatus'),
      nested: store.context.nested,
    }).toEqual({
      open: true,
      anchorElement: anchor,
      positionerElement,
      transitionStatus: undefined,
      nested: false,
    });
    expect(store.select('defaultPopupId')).toMatch(/\S/);
  });

  it('follows the open state and the positioner element when they change', async () => {
    const positionerElement = document.createElement('div');
    const { store, setProps } = await renderStore();
    expect(store.select('open')).toBe(false);
    expect(store.select('positionerElement')).toBe(null);

    await setProps({ open: true });
    expect(store.select('open')).toBe(true);

    await setProps({ open: undefined });
    expect(store.select('open')).toBe(false);

    await setProps({ positionerElement });
    expect(store.select('positionerElement')).toBe(positionerElement);
  });

  it('keeps the element whose source gives undefined, and clears it for null', async () => {
    const anchor = document.createElement('button');
    const positionerElement = document.createElement('div');
    const { store, setProps } = await renderStore({ anchor, positionerElement });

    await setProps({ anchor: undefined, positionerElement: undefined });
    expect(store.select('anchorElement')).toBe(anchor);
    expect(store.select('positionerElement')).toBe(positionerElement);

    await setProps({ anchor: null, positionerElement: null });
    expect(store.select('anchorElement')).toBe(null);
    expect(store.select('positionerElement')).toBe(null);
  });

  it('gives the elements back when open changes after clearPositioning', async () => {
    const anchor = document.createElement('button');
    const positionerElement = document.createElement('div');
    const { store, setProps } = await renderStore({ open: true, anchor, positionerElement });

    store.clearPositioning();
    expect(store.select('anchorElement')).toBe(null);
    expect(store.select('positionerElement')).toBe(null);

    await setProps({ open: false });

    expect(store.select('anchorElement')).toBe(anchor);
    expect(store.select('positionerElement')).toBe(positionerElement);
  });

  it('calls the onOpenChange option when an interaction composable requests an open change', async () => {
    const onOpenChange = vi.fn();
    const { store } = await renderStore({ onOpenChange });
    const eventDetails = createChangeEventDetails(REASONS.triggerPress);

    store.setOpen(true, eventDetails);

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(true, eventDetails);
  });

  describe('nested', () => {
    async function renderBelowNode(props: Omit<TestProps, 'onStore'> = {}) {
      const parentId = shallowRef<string | undefined>('parent');
      const Parent = defineComponent((_, { slots }) => {
        provideFloatingNode(parentId);
        return () => slots.default?.();
      });
      let store!: FloatingRootStore;
      await render(
        <Parent>
          <Test
            {...props}
            onStore={(value) => {
              store = value;
            }}
          />
        </Parent>,
      );
      return { store, parentId };
    }

    it('is true below a floating node', async () => {
      const { store } = await renderBelowNode();

      expect(store.context.nested).toBe(true);
    });

    it('follows a change of the parent node', async () => {
      const { store, parentId } = await renderBelowNode();

      parentId.value = undefined;
      await nextTick();

      expect(store.context.nested).toBe(false);
    });

    it('leaves the elements cleared when the parent node changes after clearPositioning', async () => {
      const anchor = document.createElement('button');
      const positionerElement = document.createElement('div');
      const { store, parentId } = await renderBelowNode({ open: false, anchor, positionerElement });

      store.clearPositioning();
      parentId.value = undefined;
      await nextTick();

      expect(store.context.nested).toBe(false);
      expect(store.select('anchorElement')).toBe(null);
      expect(store.select('positionerElement')).toBe(null);
    });
  });
});
