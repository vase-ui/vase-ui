import { expect, it } from 'vitest';
import { shallowRef } from 'vue';
import { Tooltip } from '@vase-ui/vue/tooltip';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';
import type { HTMLProps } from '../../internals/types';
import { fieldsetDisabledTests } from '../../../test/fieldsetDisabledTests';

fieldsetDisabledTests({
  part: (props, slots) => <Tooltip.Trigger delay={100} {...props} v-slots={slots} />,
  root: (children) => <Tooltip.Root>{children}</Tooltip.Root>,
  hover: true,
  tooltip: true,
});

const { render } = createRenderer();

it('VUE-112: reads the element of the render slot instead of the default tag', async () => {
  const native = shallowRef(true);
  await render(() => (
    <Tooltip.Root>
      <fieldset disabled>
        <Tooltip.Trigger
          v-slots={{
            render: ({ props, state }: { props: HTMLProps; state: Tooltip.Trigger.State }) =>
              native.value ? (
                <button {...props} data-testid="target">
                  {String(state.disabled)}
                </button>
              ) : (
                <span {...props} data-testid="target">
                  {String(state.disabled)}
                </span>
              ),
          }}
        />
      </fieldset>
    </Tooltip.Root>
  ));
  expect(screen.getByTestId('target')).toHaveAttribute('data-disabled');
  expect(screen.getByTestId('target').textContent).toBe('true');
  native.value = false;
  await flushMicrotasks();
  const custom = screen.getByTestId('target');
  expect(custom.tagName).toBe('SPAN');
  expect(custom).not.toHaveAttribute('data-disabled');
  expect(custom).not.toHaveAttribute('data-trigger-disabled');
  expect(custom.textContent).toBe('false');
});
