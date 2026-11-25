import { PreviewCard } from '@base-ui/react/preview-card';
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

export default function AnimatedPreviewCard() {
  return (
    <div className="bench-page">
      <style>{ANIMATION}</style>
      <PreviewCard.Root>
        <PreviewCard.Trigger href="#preview" data-bench="trigger" delay={0} closeDelay={0}>
          Open
        </PreviewCard.Trigger>
        <PreviewCard.Portal>
          <PreviewCard.Positioner>
            <PreviewCard.Popup data-bench="popup" className="bench-motion">
              <PreviewCard.Arrow />
              Preview
            </PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    </div>
  );
}
