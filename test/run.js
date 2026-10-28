'use strict';
const Module = require('module');
const assert = require('assert');

let pollCount = 0;
const origLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === 'obsidian') {
    const noop = class {};
    return {
      Plugin: noop,
      Modal: noop,
      PluginSettingTab: noop,
      Setting: noop,
      MarkdownView: noop,
      Notice: noop,
      normalizePath: (p) => p,
      requestUrl: async (o) => {
        if (o.url.endsWith('/api/v1/account/balance')) {
          return { status: 200, json: { credits: 120 } };
        }
        if (o.url.endsWith('/api/v1/credits/estimate')) {
          return { status: 200, json: { estimated_credits: 15 } };
        }
        if (o.url.endsWith('/api/v1/generations')) {
          return { status: 200, json: { id: 'task_99', status: 'processing' } };
        }
        if (o.url.includes('/api/v1/tasks/task_99')) {
          pollCount++;
          return {
            status: 200,
            json: pollCount >= 2
              ? { id: 'task_99', status: 'succeeded', output_url: 'https://wan2-7.io/cdn/out.mp4' }
              : { id: 'task_99', status: 'processing' },
          };
        }
        return { status: 404, json: {} };
      },
    };
  }
  return origLoad.call(this, req, ...rest);
};

const { runWan27, accountBalance, estimateCredits, explain, URLS } = require('../main.js');

(async () => {
  assert.strictEqual(URLS.website, 'https://wan2-7.io/');
  assert.strictEqual(URLS.mcp, 'https://wan2-7.io/mcp/');
  assert.strictEqual(URLS.mcpGuide, 'https://wan2-7.io/mcp/guide/');
  assert.strictEqual(URLS.cli, 'https://wan2-7.io/cli/');
  assert.strictEqual(URLS.pricing, 'https://wan2-7.io/pricing/');

  assert.strictEqual(await accountBalance('wan27_tok'), 120);
  assert.strictEqual(await estimateCredits('neon city', { apiKey: 'wan27_tok' }), 15);
  assert.strictEqual(await runWan27('neon city', { apiKey: 'wan27_tok', pollEveryMs: 0 }), 'https://wan2-7.io/cdn/out.mp4');

  await assert.rejects(runWan27('neon city', { apiKey: '' }), (e) => e.kind === 'auth');
  assert.strictEqual(explain(401).kind, 'auth');
  assert.strictEqual(explain(402).kind, 'quota');
  assert.strictEqual(explain(403).kind, 'plan');
  assert.strictEqual(explain(409).kind, 'busy');
  console.log('obsidian-wan27: all tests passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
