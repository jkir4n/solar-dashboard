import test from 'node:test';
import assert from 'node:assert/strict';
import { L, t } from '../src/i18n.js';
import { WEATHER_KEYS as W, SKY_KEYS } from '../src/i18n-weather.js';
const WEATHER_KEYS = [...W, ...SKY_KEYS];

test('every locale has every weather and provenance label', () => {
  for (const lang of Object.keys(L)) for (const key of WEATHER_KEYS) {
    assert.ok(typeof L[lang][key] === 'string' && L[lang][key].length > 0, `${lang}.${key}`);
  }
});
test('non-English locales are translated, not copied from English', () => {
  for (const lang of Object.keys(L).filter(l => l !== 'en')) {
    const same = WEATHER_KEYS.filter(k => L[lang][k] === L.en[k]).length;
    assert.ok(same <= 6, `${lang} reuses ${same} English labels`);
  }
});
test('regional locale falls back to its base and unknown conditions fall back to key', () => {
  assert.equal(t('de-AT', 'cond_hail'), 'Hagel');
  assert.equal(t('en', 'cond_unknown-thing'), 'cond_unknown-thing');
});
