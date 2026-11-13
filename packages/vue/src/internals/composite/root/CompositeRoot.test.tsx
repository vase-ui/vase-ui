import { expect, vi, describe, it } from 'vitest';
import { defineComponent } from 'vue';
import { createRenderer } from '#test-utils';
import CompositeRoot from '../../../../test/fixtures/CompositeRootPart.vue';
import { useCompositeListItem } from '../list/useCompositeListItem';

// Vue types a template ref as an element, a component or `null`.
function bindRef(ref: (node: HTMLElement | null) => void) {
  return (node: unknown) => ref(node as HTMLElement | null);
}

describe('Composite', () => {
  const { render } = createRenderer();

  const IndexedItem = defineComponent(
    (props: { index: number; active?: boolean | undefined; testId: string }) => {
      const { ref } = useCompositeListItem({ index: () => props.index });
      return () => (
        <div
          ref={bindRef(ref)}
          data-testid={props.testId}
          data-composite-item-active={props.active ? '' : undefined}
        />
      );
    },
    { props: ['index', 'active', 'testId'] },
  );

  describe('list', () => {
    it('uses an active item explicit index as the initial highlighted index', async () => {
      const onHighlightedIndexChange = vi.fn();

      await render(
        <CompositeRoot highlightedIndex={0} onHighlightedIndexChange={onHighlightedIndexChange}>
          <IndexedItem testId="two" index={2} active />
          <IndexedItem testId="zero" index={0} />
          <IndexedItem testId="one" index={1} />
        </CompositeRoot>,
      );

      expect(onHighlightedIndexChange).toHaveBeenCalledWith(2);
    });
  });
});
