import { Select } from '@base-ui/react/select';
import { options } from '../../../harness/options.ts';
import '../../../behavior/style.css';

const ANIMATION = `
[data-bench='popup'] {
  transform-origin: var(--transform-origin);
}

.bench-motion[data-starting-style],
.bench-motion[data-ending-style] {
  opacity: var(--bench-hidden-opacity);
  transform: var(--bench-hidden-transform);
}
`;

export default function AnimatedSelect() {
  return (
    <div className="bench-page">
      <style>{ANIMATION}</style>
      <Select.Root defaultValue="Option 1">
        <Select.Label>Label</Select.Label>
        <Select.Trigger data-bench="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup data-bench="popup" className="bench-motion">
              <Select.List>
                {options.map((option) => (
                  <Select.Item key={option} value={option}>
                    <Select.ItemText>{option}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
