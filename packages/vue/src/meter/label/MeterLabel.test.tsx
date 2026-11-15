import { expect, describe, it } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import { Meter } from '@vase-ui/vue/meter';
import {
  createHeldBranch,
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
  takeReportedMessages,
} from '#test-utils';

describe('<Meter.Label />', () => {
  const { render } = createRenderer();

  describeConformance(<Meter.Label />, () => ({
    render: (node) => {
      return render(<Meter.Root value={50}>{node}</Meter.Root>);
    },
    refInstanceof: window.HTMLSpanElement,
  }));

  it('updates and clears the meter label association', async () => {
    const App = defineComponent(() => {
      const labelId = shallowRef('label-a');
      const showLabel = shallowRef(true);

      return () => (
        <>
          <Meter.Root value={50}>
            {showLabel.value ? <Meter.Label id={labelId.value}>Battery level</Meter.Label> : null}
          </Meter.Root>
          <button
            type="button"
            onClick={() => {
              labelId.value = 'label-b';
            }}
          >
            Change id
          </button>
          <button
            type="button"
            onClick={() => {
              showLabel.value = false;
            }}
          >
            Remove label
          </button>
        </>
      );
    });

    await render(<App />);

    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-labelledby', 'label-a');

    await fireEvent.click(screen.getByRole('button', { name: 'Change id' }));
    expect(meter).toHaveAttribute('aria-labelledby', 'label-b');

    await fireEvent.click(screen.getByRole('button', { name: 'Remove label' }));
    expect(meter).not.toHaveAttribute('aria-labelledby');
  });

  it('names the meter with the label only while KeepAlive shows the label', async () => {
    const visible = shallowRef(true);
    const App = defineComponent(() => () => (
      <Meter.Root value={50}>
        <KeepAlive>
          {visible.value ? <Meter.Label data-testid="label">Battery level</Meter.Label> : null}
        </KeepAlive>
      </Meter.Root>
    ));
    await render(<App />);
    const meter = screen.getByRole('meter');
    const label = screen.getByTestId('label');
    expect(meter).toHaveAttribute('aria-labelledby', label.id);

    visible.value = false;
    await flushMicrotasks();
    expect(meter).not.toHaveAttribute('aria-labelledby');

    visible.value = true;
    await flushMicrotasks();
    // The same element proves that `KeepAlive` kept the label and did not mount a new one.
    expect(screen.getByTestId('label')).toBe(label);
    expect(meter).toHaveAttribute('aria-labelledby', label.id);
  });

  it('names the last label after KeepAlive shows a label that mounted while held', async () => {
    const { HeldBranch, hide, mountWhileHeld, show } = createHeldBranch(
      () => (
        <Meter.Label key="b" id="label-b">
          B
        </Meter.Label>
      ),
      {
        renderBranch: (part) => (
          <div>
            <Meter.Label key="a" id="label-a">
              A
            </Meter.Label>
            {part}
          </div>
        ),
      },
    );
    const App = defineComponent(() => () => (
      <Meter.Root value={40}>
        <HeldBranch />
      </Meter.Root>
    ));
    await render(<App />);
    const meter = screen.getByRole('meter');
    const seen = [meter.getAttribute('aria-labelledby')];
    for (const change of [hide, mountWhileHeld, show, hide, show]) {
      await change();
      seen.push(meter.getAttribute('aria-labelledby'));
    }

    expect(seen).toEqual(['label-a', null, null, 'label-b', null, 'label-b']);
  });

  it('throws a descriptive error when rendered outside <Meter.Root>', async () => {
    await expect(render(<Meter.Label />)).rejects.toThrow(
      'Vase UI: A part of Meter must be inside <Meter.Root>. Without a root the part has no value to show. Put the part inside <Meter.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
