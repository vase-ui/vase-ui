import { expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import { Tabs } from '@vase-ui/vue/tabs';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';
import { fieldsetDisabledTests } from '../../../test/fieldsetDisabledTests';

fieldsetDisabledTests({
  part: (props, slots) => <Tabs.Tab value={props['data-testid']} {...props} v-slots={slots} />,
  root: (children) => (
    <Tabs.Root defaultValue="other">
      <Tabs.List>
        <Tabs.Tab value="other">Other</Tabs.Tab>
        {children}
      </Tabs.List>
    </Tabs.Root>
  ),
});

const { render } = createRenderer();

it('VUE-112: keeps the selected panel when the fieldset becomes disabled', async () => {
  const fieldsetDisabled = shallowRef(false);
  const tabDisabled = shallowRef(false);
  const change = vi.fn();
  await render(() => (
    <Tabs.Root defaultValue="b" onValueChange={change}>
      <fieldset disabled={fieldsetDisabled.value}>
        <Tabs.List>
          <Tabs.Tab value="a" data-testid="a">
            A
          </Tabs.Tab>
          <Tabs.Tab value="b" data-testid="b" disabled={tabDisabled.value}>
            B
          </Tabs.Tab>
        </Tabs.List>
      </fieldset>
      <Tabs.Panel value="a">Panel A</Tabs.Panel>
      <Tabs.Panel value="b">Panel B</Tabs.Panel>
    </Tabs.Root>
  ));
  const selected = screen.getByTestId('b');
  expect(selected).toHaveAttribute('aria-selected', 'true');

  fieldsetDisabled.value = true;
  await flushMicrotasks();
  expect(selected).toHaveAttribute('data-disabled');
  expect(selected).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel B');
  expect(change).not.toHaveBeenCalled();

  fieldsetDisabled.value = false;
  await flushMicrotasks();
  expect(selected).not.toHaveAttribute('data-disabled');
  expect(selected).toHaveAttribute('aria-selected', 'true');
  expect(change).not.toHaveBeenCalled();

  tabDisabled.value = true;
  await flushMicrotasks();
  expect(screen.getByTestId('a')).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel A');
  expect(change).toHaveBeenCalledOnce();
});
