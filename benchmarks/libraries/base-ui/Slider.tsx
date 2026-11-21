import { Slider } from '@base-ui/react/slider';

export default function SliderScenario() {
  return (
    <Slider.Root defaultValue={50}>
      <Slider.Control>
        <Slider.Track>
          <Slider.Indicator />
          <Slider.Thumb />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}
