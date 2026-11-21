import { Select } from '@base-ui/react/select';
import { options } from '../../harness/options.ts';

export default function SelectScenario() {
  return (
    <Select.Root>
      <Select.Label>Label</Select.Label>
      <Select.Trigger data-bench="trigger">
        <Select.Value />
        <Select.Icon />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner>
          <Select.Popup data-bench="popup">
            <Select.ScrollUpArrow />
            <Select.List>
              {options.map((option) => (
                <Select.Item key={option} value={option}>
                  <Select.ItemIndicator />
                  <Select.ItemText>{option}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
            <Select.ScrollDownArrow />
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
