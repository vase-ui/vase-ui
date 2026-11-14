import { describe, expect, it, vi } from 'vitest';
import { createRenderer, fireEvent, screen } from '#test-utils';
import * as Combobox from '../index.parts';

vi.mock('../../common/platform', async () => {
  const actual =
    await vi.importActual<typeof import('../../common/platform')>('../../common/platform');

  return {
    ...actual,
    platform: {
      ...actual.platform,
      os: {
        ...actual.platform.os,
        android: true,
      },
    },
  };
});

describe('<Combobox.Input /> on Android', () => {
  const { render } = createRenderer();

  it('propagates changes during Android composition', async () => {
    const onInputValueChange = vi.fn();
    await render(
      <Combobox.Root onInputValueChange={onInputValueChange}>
        <Combobox.Input />
      </Combobox.Root>,
    );

    const input = screen.getByRole('combobox');
    await fireEvent.compositionStart(input);
    await fireEvent.input(input, { target: { value: 'a' } });

    expect(onInputValueChange).toHaveBeenCalledWith('a', expect.anything());
  });
});
