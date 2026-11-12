import { expect, describe, it } from 'vitest';
import { defineComponent } from 'vue';
import { createRenderer, screen } from '#test-utils';
import { useLabelId, useRegisteredLabelId } from './useRegisteredLabelId';
import type { LabelIdSetter } from './useRegisteredLabelId';

describe('useRegisteredLabelId', () => {
  const { render } = createRenderer();

  const Label = defineComponent(
    (props: { id: string; setLabelId: LabelIdSetter; defaultLabelId: string }, { slots }) => {
      const registeredId = useRegisteredLabelId(
        () => props.id,
        props.setLabelId,
        () => props.defaultLabelId,
      );

      return () => <span id={registeredId.value}>{slots.default?.()}</span>;
    },
    { props: ['id', 'setLabelId', 'defaultLabelId'] },
  );

  const Test = defineComponent(
    (props: { labels: 'old' | 'both' | 'new' }) => {
      const { labelId, defaultLabelId, setLabelId } = useLabelId();

      return () => (
        <>
          <div data-testid="target" aria-labelledby={labelId.value} />
          {props.labels !== 'new' && (
            <Label
              key="old"
              id="old-label"
              setLabelId={setLabelId}
              defaultLabelId={defaultLabelId.value}
            >
              Old
            </Label>
          )}
          {props.labels !== 'old' && (
            <Label
              key="new"
              id="new-label"
              setLabelId={setLabelId}
              defaultLabelId={defaultLabelId.value}
            >
              New
            </Label>
          )}
        </>
      );
    },
    { props: ['labels'] },
  );

  it('does not let an older label cleanup clear a newer label', async () => {
    const { rerender } = await render(<Test labels="old" />);

    const target = screen.getByTestId('target');
    expect(target).toHaveAttribute('aria-labelledby', 'old-label');

    await rerender(<Test labels="both" />);
    expect(target).toHaveAttribute('aria-labelledby', 'new-label');

    await rerender(<Test labels="new" />);
    expect(target).toHaveAttribute('aria-labelledby', 'new-label');
  });
});
