import { describe, expect, it, vi } from 'vitest';
import { createRenderer, screen } from '#test-utils';
import RangeLabelSlot from './fixtures/RangeLabelSlot.vue';

describe('range label text', () => {
  const { render } = createRenderer();

  it('keeps the hidden text after the progressbar render slot content', async () => {
    const text = vi.fn((label: string) => label);
    const { setProps } = await render(<RangeLabelSlot label="Capacity" text={text} />);
    const range = screen.getByRole('progressbar', { name: 'Capacity' });
    const hidden = range.lastElementChild;
    expect(range.tagName).toBe('SECTION');
    expect(range.children).toHaveLength(2);
    expect(range.firstElementChild).toHaveTextContent('Capacity');
    expect(text).toHaveBeenCalledWith('Capacity');
    expect(hidden).toHaveAttribute('role', 'presentation');
    expect(hidden).toHaveTextContent('x');
    expect(hidden).toHaveStyle({ clipPath: 'inset(50%)' });

    text.mockClear();
    await setProps({ label: 'Charge' });
    expect(range).toHaveAccessibleName('Charge');
    expect(range.firstElementChild).toHaveTextContent('Charge');
    expect(range.lastElementChild).toBe(hidden);
    expect(text.mock.calls).toEqual([['Charge']]);
  });
});
