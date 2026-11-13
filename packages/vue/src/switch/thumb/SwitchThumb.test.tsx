import { expect, describe, it } from 'vitest';
import { computed, defineComponent, provide } from 'vue';
import { Switch } from '@vase-ui/vue/switch';
import { createRenderer, describeConformance, takeReportedMessages } from '#test-utils';
import { SwitchRootContext } from '../root/SwitchRootContext';

const testContext: SwitchRootContext = computed(() => ({
  checked: false,
  disabled: false,
  readOnly: false,
  required: false,
  dirty: false,
  touched: false,
  filled: false,
  focused: false,
  valid: null,
}));

const TestContext = defineComponent((_, { slots }) => {
  provide(SwitchRootContext, testContext);
  return () => slots.default?.();
});

describe('<Switch.Thumb />', () => {
  const { render } = createRenderer();

  describeConformance(<Switch.Thumb />, () => ({
    refInstanceof: window.HTMLSpanElement,
    render: (node) => render(<TestContext>{node}</TestContext>),
  }));

  it('throws a descriptive error when rendered outside <Switch.Root>', async () => {
    await expect(render(<Switch.Thumb />)).rejects.toThrow(
      'Vase UI: A part of Switch must be inside <Switch.Root>. Without a root the part has no state to show. Put the part inside <Switch.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
