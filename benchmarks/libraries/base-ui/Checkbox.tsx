import { Checkbox } from '@base-ui/react/checkbox';

export default function CheckboxScenario() {
  return (
    <label>
      <Checkbox.Root>
        <Checkbox.Indicator />
      </Checkbox.Root>
      Label
    </label>
  );
}
