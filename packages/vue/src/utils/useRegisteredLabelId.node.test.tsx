import { expect, describe, it } from 'vitest';
import { defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { useLabelId, useRegisteredLabelId } from './useRegisteredLabelId';
import type { LabelIdRoot } from './useRegisteredLabelId';

describe('useRegisteredLabelId on a server', () => {
  const Label = defineComponent(
    (props: { id: string; root: LabelIdRoot }) => {
      const id = useRegisteredLabelId(() => props.id, props.root, null);

      return () => <span id={id.value} />;
    },
    { props: ['id', 'root'] },
  );

  it('VUE-131: names the last registered label in a part that renders after the labels', async () => {
    const App = defineComponent(() => {
      const { labelId, labelRoot } = useLabelId();
      // A server renders this component after the `setup` of both labels, as it renders a radio
      // group after the legends of its fieldset.
      const Reader = () => <div aria-labelledby={labelId.value} />;

      return () => (
        <>
          <Label id="label-a" root={labelRoot} />
          <Label id="label-b" root={labelRoot} />
          <Reader />
        </>
      );
    });

    const html = await renderToString(<App />);

    expect(html).toContain('<div aria-labelledby="label-b"></div>');
  });
});
