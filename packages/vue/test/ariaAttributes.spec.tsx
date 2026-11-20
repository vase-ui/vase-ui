import { Resizable } from '../src/resizable';
import { Slider } from '@vase-ui/vue/slider';

<Slider.Root aria-labelledby="id" />;
// @ts-expect-error `aria-labelledby` is a string
<Slider.Root aria-labelledby={5} />;

<Slider.Thumb aria-label="x" aria-labelledby="id" aria-describedby="id" aria-valuetext="x" />;
// @ts-expect-error `aria-label` is a string
<Slider.Thumb aria-label={5} />;
// @ts-expect-error `aria-labelledby` is a string
<Slider.Thumb aria-labelledby={5} />;
// @ts-expect-error `aria-describedby` is a string
<Slider.Thumb aria-describedby={5} />;
// @ts-expect-error `aria-valuetext` is a string
<Slider.Thumb aria-valuetext={5} />;

<Resizable.Handle aria-valuetext="x" />;
// @ts-expect-error `aria-valuetext` is a string
<Resizable.Handle aria-valuetext={5} />;
