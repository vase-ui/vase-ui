import { expect, describe, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { Meter } from '@vase-ui/vue/meter';
import {
  createRenderer,
  describeConformance,
  fireEvent,
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
