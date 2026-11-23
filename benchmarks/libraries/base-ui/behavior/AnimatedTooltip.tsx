import { Tooltip } from '@base-ui/react/tooltip';
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

export default function AnimatedTooltip() {
  return (
    <div className="bench-page">
      <style>{ANIMATION}</style>
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger data-bench="trigger" delay={0} closeDelay={0}>
            Open
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-bench="popup" className="bench-motion">
                <Tooltip.Arrow />
                Tooltip
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    </div>
  );
}
