import test from 'node:test';
import assert from 'node:assert/strict';
import { describeWeather, weatherAdvice, buildWeatherPayload } from '../../src/renderer/features/weather.js';

test('weather codes map to readable descriptions and icons', () => {
  assert.deepEqual(describeWeather(0), { text: '晴', icon: 'sun' });
  assert.equal(describeWeather(61).text, '小雨');
  assert.equal(describeWeather(95).icon, 'storm');
  assert.equal(describeWeather(9999).text, '天气变化中');
});

test('advice covers rain, snow, heat, cold and wind', () => {
  assert.match(weatherAdvice({ ok: true, weatherCode: 61 }), /伞/);
  assert.match(weatherAdvice({ ok: true, weatherCode: 71 }), /雪|保暖/);
  assert.match(weatherAdvice({ ok: true, weatherCode: 0, temperature: 35 }), /热|补水/);
  assert.match(weatherAdvice({ ok: true, weatherCode: 0, temperature: 0 }), /冷|外套/);
  assert.match(weatherAdvice({ ok: true, weatherCode: 0, temperature: 20, wind: 40 }), /风/);
  assert.equal(weatherAdvice({ ok: false }), '');
});

test('payload uses defaults for missing settings', () => {
  assert.deepEqual(buildWeatherPayload(null), { city: '西安', lat: 34.26, lon: 108.94 });
  assert.deepEqual(buildWeatherPayload({ city: '北京', lat: 39.9, lon: 116.4 }), { city: '北京', lat: 39.9, lon: 116.4 });
});
