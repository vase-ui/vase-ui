import { Combobox } from '@base-ui/react/combobox';
import { useId } from 'react';
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

export default function AnimatedCombobox() {
  const id = useId();
  return (
    <div className="bench-page">
      <style>{ANIMATION}</style>
      <Combobox.Root items={options}>
        <label htmlFor={id}>Label</label>
        <Combobox.InputGroup data-bench="anchor">
          <Combobox.Input id={id} data-bench="input" />
          <Combobox.Clear>Clear</Combobox.Clear>
          <Combobox.Trigger data-bench="trigger">Open</Combobox.Trigger>
        </Combobox.InputGroup>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-bench="popup" className="bench-motion">
              <Combobox.Empty>No results</Combobox.Empty>
              <Combobox.List>
                {(item: string) => (
                  <Combobox.Item key={item} value={item}>
                    {item}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  );
}
