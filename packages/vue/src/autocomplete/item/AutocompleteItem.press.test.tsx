import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import {
  createRenderer,
  flushMicrotasks,
  holdPress,
  screen,
  waitFor,
  waitForLaterMillisecond,
  waitForPositioned,
} from '#test-utils';

const names = ['one', 'two', 'three', 'four', 'five', 'six'];
const block = {
  display: 'block',
  width: '200px',
  height: '30px',
  boxSizing: 'border-box',
} as const;

describe('<Autocomplete.Item />', () => {
  const { render } = createRenderer();

  // The height of the control above the anchor puts the first item at the point of the press when
  // the control goes at the open.
  it.each([
    { name: 'the input outside the popup', inputInsidePopup: false, controlHeight: 10 },
    { name: 'the input in the popup', inputInsidePopup: true, controlHeight: 60 },
  ])(
    'VUE-84: selects no item for a release at the point of the press that opened the popup, $name',
    async ({ inputInsidePopup, controlHeight }) => {
      const shifted = shallowRef(false);
      const onValueChange = vi.fn();
      const onOpenChange = vi.fn((open: boolean) => {
        shifted.value = open;
      });
      await render(() => (
        <div>
          {!shifted.value && <div style={{ height: `${controlHeight}px` }}>Status</div>}
          <Autocomplete.Root
            autoHighlight="always"
            onOpenChange={onOpenChange}
            onValueChange={onValueChange}
          >
            {!inputInsidePopup && <Autocomplete.Input style={block} />}
            <Autocomplete.Trigger data-testid="trigger" style={block}>
              Search
            </Autocomplete.Trigger>
            <Autocomplete.Portal>
              <Autocomplete.Positioner data-testid="positioner">
                <Autocomplete.Popup style={{ width: '200px' }}>
                  {inputInsidePopup && <Autocomplete.Input style={block} />}
                  <Autocomplete.List>
                    {names.map((name) => (
                      <Autocomplete.Item key={name} value={name} style={block}>
                        {name}
                      </Autocomplete.Item>
                    ))}
                  </Autocomplete.List>
                </Autocomplete.Popup>
              </Autocomplete.Positioner>
            </Autocomplete.Portal>
          </Autocomplete.Root>
        </div>
      ));

      const { point, release } = await waitForLaterMillisecond(() =>
        holdPress(screen.getByTestId('trigger')),
      );
      await waitForPositioned(await screen.findByTestId('positioner'));
      // WebKit moves no highlight for a pointer that does not move: the item at the point has the
      // highlight of `autoHighlight`.
      await waitFor(() => {
        expect(
          document.elementFromPoint(point.x, point.y)?.closest('[role="option"]'),
        ).toHaveAttribute('data-highlighted');
      });
      await release();
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(onOpenChange.mock.calls.map(([open]) => open)).toEqual([true]);
    },
  );
});
