import { describe, expect, it, vi } from 'vitest';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import { createRenderer, screen } from '#test-utils';
import * as Combobox from '../index.parts';

vi.mock('../../common/platform', async () => {
  const actual =
    await vi.importActual<typeof import('../../common/platform')>('../../common/platform');

  return {
    ...actual,
    platform: {
      ...actual.platform,
      engine: {
        ...actual.platform.engine,
        gecko: true,
      },
    },
  };
});

describe('<Combobox.Input /> in Gecko RTL', () => {
  const { render } = createRenderer();

  it('uses Gecko RTL caret positions for Home and End', async () => {
    const { user } = await render(
      <DirectionProvider direction="rtl">
        <Combobox.Root defaultInputValue="apple">
          <Combobox.Input />
        </Combobox.Root>
      </DirectionProvider>,
    );

    const input = screen.getByRole<HTMLInputElement>('combobox');
    input.focus();

    await user.keyboard('{Home}');
    expect(input.selectionStart).toBe(input.value.length);

    await user.keyboard('{End}');
    expect(input.selectionStart).toBe(0);
  });
});
