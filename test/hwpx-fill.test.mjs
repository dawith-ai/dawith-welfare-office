import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { renderTemplate } from '../src/template-engine.mjs';

// 한글 caches line positions in <hp:linesegarray>; keeping the old cache after
// changing the text made 한글 draw overlapping lines. Found by opening a filled
// form in Hancom 한글 itself.
test('filling an HWPX form drops stale line layout caches only where text changed', async () => {
  const lineseg = '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray>';
  const zip = new JSZip();
  zip.file('mimetype', 'application/hwp+zip');
  zip.file('Contents/section0.xml', `<hs:sec><hp:p><hp:run><hp:t>소견: {{상담원 소견}}</hp:t></hp:run>${lineseg}</hp:p></hs:sec>`);
  zip.file('Contents/section1.xml', `<hs:sec><hp:p><hp:run><hp:t>바뀌지 않는 문단</hp:t></hp:run>${lineseg}</hp:p></hs:sec>`);
  const data = await zip.generateAsync({ type: 'nodebuffer' });
  const output = await JSZip.loadAsync(await renderTemplate({ fileName: '상담일지.hwpx', data, fields: { '상담원 소견': '첫 줄\n둘째 줄' } }));
  const changed = await output.file('Contents/section0.xml').async('string');
  const untouched = await output.file('Contents/section1.xml').async('string');
  assert.match(changed, /소견: 첫 줄<hp:lineBreak\/>둘째 줄/);
  assert.doesNotMatch(changed, /linesegarray/);
  assert.match(untouched, /linesegarray/);
});
