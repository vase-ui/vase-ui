import { expect, describe, it } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';
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

  describe('under `KeepAlive`', () => {
    const Labels = defineComponent(
      (props: { setLabelId: LabelIdSetter; defaultLabelId: string }) => () => (
        <>
          <Label id="first" setLabelId={props.setLabelId} defaultLabelId={props.defaultLabelId}>
            First
          </Label>
          <Label id="middle" setLabelId={props.setLabelId} defaultLabelId={props.defaultLabelId}>
            Middle
          </Label>
          <Label id="last" setLabelId={props.setLabelId} defaultLabelId={props.defaultLabelId}>
            Last
          </Label>
        </>
      ),
      { props: ['setLabelId', 'defaultLabelId'] },
    );

    it('names the last label of a branch again when KeepAlive shows the branch', async () => {
      const visible = shallowRef(true);
      const App = defineComponent(() => {
        const { labelId, defaultLabelId, setLabelId } = useLabelId();

        return () => (
          <>
            <div data-testid="target" aria-labelledby={labelId.value} />
            <KeepAlive>
              {visible.value ? (
                <Labels setLabelId={setLabelId} defaultLabelId={defaultLabelId.value} />
              ) : null}
            </KeepAlive>
          </>
        );
      });
      await render(<App />);
      const target = screen.getByTestId('target');
      expect(target).toHaveAttribute('aria-labelledby', 'last');

      visible.value = false;
      await flushMicrotasks();
      expect(target).not.toHaveAttribute('aria-labelledby');

      visible.value = true;
      await flushMicrotasks();
      expect(target).toHaveAttribute('aria-labelledby', 'last');
    });

    it('names the label that KeepAlive shows when two kept labels replace each other', async () => {
      const shown = shallowRef<'a' | 'b'>('a');
      const App = defineComponent(() => {
        const { labelId, defaultLabelId, setLabelId } = useLabelId();

        return () => (
          <>
            <div data-testid="target" aria-labelledby={labelId.value} />
            <KeepAlive>
              <Label
                key={shown.value}
                id={`label-${shown.value}`}
                setLabelId={setLabelId}
                defaultLabelId={defaultLabelId.value}
              >
                Label
              </Label>
            </KeepAlive>
          </>
        );
      });
      await render(<App />);
      const target = screen.getByTestId('target');
      expect(target).toHaveAttribute('aria-labelledby', 'label-a');

      shown.value = 'b';
      await flushMicrotasks();
      expect(target).toHaveAttribute('aria-labelledby', 'label-b');

      shown.value = 'a';
      await flushMicrotasks();
      expect(target).toHaveAttribute('aria-labelledby', 'label-a');

      shown.value = 'b';
      await flushMicrotasks();
      expect(target).toHaveAttribute('aria-labelledby', 'label-b');
    });

    it('gives the root a new id of a held label only when KeepAlive shows the label', async () => {
      const visible = shallowRef(true);
      const labelId = shallowRef('label-a');
      // The branch reads the id in its own render, so the held label gets the new id.
      const Branch = defineComponent(
        (props: { setLabelId: LabelIdSetter; defaultLabelId: string }) => () => (
          <Label
            id={labelId.value}
            setLabelId={props.setLabelId}
            defaultLabelId={props.defaultLabelId}
          >
            Label
          </Label>
        ),
        { props: ['setLabelId', 'defaultLabelId'] },
      );
      const App = defineComponent(() => {
        const { labelId: rootLabelId, defaultLabelId, setLabelId } = useLabelId();

        return () => (
          <>
            <div data-testid="target" aria-labelledby={rootLabelId.value} />
            <KeepAlive>
              {visible.value ? (
                <Branch setLabelId={setLabelId} defaultLabelId={defaultLabelId.value} />
              ) : null}
            </KeepAlive>
          </>
        );
      });
      await render(<App />);
      const target = screen.getByTestId('target');
      expect(target).toHaveAttribute('aria-labelledby', 'label-a');

      visible.value = false;
      await flushMicrotasks();
      expect(target).not.toHaveAttribute('aria-labelledby');

      labelId.value = 'label-c';
      await flushMicrotasks();
      expect(target).not.toHaveAttribute('aria-labelledby');

      visible.value = true;
      await flushMicrotasks();
      expect(target).toHaveAttribute('aria-labelledby', 'label-c');
    });
  });
});
