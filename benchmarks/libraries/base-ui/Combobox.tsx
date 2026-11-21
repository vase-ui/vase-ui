import { Combobox } from '@base-ui/react/combobox';
import { useId } from 'react';
import { options } from '../../harness/options.ts';

export default function ComboboxScenario() {
  const id = useId();
  return (
    <Combobox.Root items={options}>
      <label htmlFor={id}>Label</label>
      <Combobox.InputGroup>
        <Combobox.Input id={id} data-bench="input" />
        <Combobox.Clear>Clear</Combobox.Clear>
        <Combobox.Trigger data-bench="trigger">Open</Combobox.Trigger>
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner>
          <Combobox.Popup data-bench="popup">
            <Combobox.Empty>No results</Combobox.Empty>
            <Combobox.List>
              {(item: string) => (
                <Combobox.Item key={item} value={item}>
                  <Combobox.ItemIndicator />
                  {item}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
