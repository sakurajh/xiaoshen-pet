import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectIntent,
  generateReply,
  getWelcome,
  formatClock,
  buildAiMessages,
  SYSTEM_PROMPT
} from '../../src/renderer/features/dialogues.js';

test('intent detection covers common moods and requests', () => {
  assert.equal(detectIntent('今天有点累'), 'tired');
  assert.equal(detectIntent('我好焦虑，ddl 快到了'), 'anxious');
  assert.equal(detectIntent('夸夸我'), 'praise');
  assert.equal(detectIntent('现在几点了'), 'time');
  assert.equal(detectIntent('讲个笑话'), 'joke');
  assert.equal(detectIntent('你是谁呀'), 'who');
  assert.equal(detectIntent('外面天气怎么样'), 'weather');
  assert.equal(detectIntent('想换件衣服'), 'outfit');
  assert.equal(detectIntent(''), 'empty');
});

test('tired reply is supportive and concise', () => {
  const reply = generateReply('今天有点累', { rng: () => 0, state: { energy: 20 } });
  assert.equal(reply.intent, 'tired');
  assert.ok(reply.text.length > 8);
  assert.ok(reply.text.length < 120);
  assert.ok(/停|累|休息|呼吸|靠/.test(reply.text));
});

test('weather reply uses provided live weather', () => {
  const reply = generateReply('今天天气怎么样', {
    rng: () => 0,
    weather: { ok: true, city: '西安', text: '多云', temperature: 16, apparent: 15 }
  });
  assert.equal(reply.intent, 'weather');
  assert.match(reply.text, /西安/);
  assert.match(reply.text, /16/);
});

test('weather reply degrades gracefully without data', () => {
  const reply = generateReply('天气', { rng: () => 0 });
  assert.equal(reply.intent, 'weather');
  assert.match(reply.text, /没有拿到天气|窗帘/);
});

test('welcome greeting is time aware and personalised', () => {
  const night = getWelcome({}, { now: new Date('2026-10-22T23:30:00') });
  assert.match(night, /睡|休息|声音/);
  const focused = getWelcome({ today: { focusMinutes: 50 } }, { now: new Date('2026-10-22T15:00:00') });
  assert.match(focused, /50/);
});

test('clock format is zero padded', () => {
  assert.equal(formatClock(new Date('2026-10-22T09:05:00')), '09:05');
});

test('AI messages include persona, state and chat history without leaking secrets', () => {
  const history = [
    { role: 'user', text: '今天好累' },
    { role: 'assistant', text: '那就歇一会儿。' }
  ];
  const messages = buildAiMessages(history, { mood: 50, energy: 40, satiety: 70, intimacy: 20, today: { focusMinutes: 10 } }, '继续聊聊');
  assert.equal(messages[0].role, 'system');
  assert.ok(messages[0].content.includes('小申'));
  assert.ok(messages[1].content.includes('心情 50'));
  assert.equal(messages.at(-1).content, '继续聊聊');
  assert.ok(SYSTEM_PROMPT.includes('不要使用 emoji'));
  assert.ok(!messages.some((m) => JSON.stringify(m).includes('apiKey')));
});

test('all intents produce a non-empty reply', () => {
  const samples = ['你好', '好累', '难过', '焦虑', '饿了', '夸我', '爱你', '论文', '天气', '几点', '笑话', '你是谁', '换装', '谢谢', '摸摸', '睡不着', '你会什么', '随便说说'];
  for (const text of samples) {
    const reply = generateReply(text, { rng: () => 0.4 });
    assert.ok(typeof reply.text === 'string' && reply.text.length > 1, text);
  }
});
