import * as Checkbox from '../src/checkbox/index.parts';
import * as OTPField from '../src/otp-field/index.parts';
import * as Radio from '../src/radio/index.parts';
import * as Slider from '../src/slider/index.parts';
import * as Switch from '../src/switch/index.parts';

<Checkbox.Root aria-label="x" aria-labelledby="id" />;
<Checkbox.Root ariaLabel="x" ariaLabelledby="id" />;
// @ts-expect-error `aria-label` is a string
<Checkbox.Root aria-label={5} />;
// @ts-expect-error `aria-labelledby` is a string
<Checkbox.Root aria-labelledby={5} />;

<OTPField.Root length={6} aria-labelledby="id" />;
<OTPField.Root length={6} ariaLabelledby="id" />;
// @ts-expect-error `aria-labelledby` is a string
<OTPField.Root length={6} aria-labelledby={5} />;

<Radio.Root value="a" aria-label="x" aria-labelledby="id" />;
<Radio.Root value="a" ariaLabel="x" ariaLabelledby="id" />;
// @ts-expect-error `aria-label` is a string
<Radio.Root value="a" aria-label={5} />;
// @ts-expect-error `aria-labelledby` is a string
<Radio.Root value="a" aria-labelledby={5} />;

<Switch.Root aria-label="x" aria-labelledby="id" />;
<Switch.Root ariaLabel="x" ariaLabelledby="id" />;
// @ts-expect-error `aria-label` is a string
<Switch.Root aria-label={5} />;
// @ts-expect-error `aria-labelledby` is a string
<Switch.Root aria-labelledby={5} />;

<Slider.Root aria-labelledby="id" />;
<Slider.Root ariaLabelledby="id" />;
// @ts-expect-error `aria-labelledby` is a string
<Slider.Root aria-labelledby={5} />;

<Slider.Thumb aria-label="x" aria-labelledby="id" aria-describedby="id" aria-valuetext="x" />;
<Slider.Thumb ariaLabel="x" ariaLabelledby="id" ariaDescribedby="id" ariaValuetext="x" />;
// @ts-expect-error `aria-label` is a string
<Slider.Thumb aria-label={5} />;
// @ts-expect-error `aria-labelledby` is a string
<Slider.Thumb aria-labelledby={5} />;
// @ts-expect-error `aria-describedby` is a string
<Slider.Thumb aria-describedby={5} />;
// @ts-expect-error `aria-valuetext` is a string
<Slider.Thumb aria-valuetext={5} />;
