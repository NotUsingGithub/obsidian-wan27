'use strict';
const { Plugin, Modal, Notice, PluginSettingTab, Setting, requestUrl, normalizePath, MarkdownView } = require('obsidian');

const URLS = Object.freeze({
  website: 'https://wan2-7.io/',
  mcp: 'https://wan2-7.io/mcp/',
  mcpGuide: 'https://wan2-7.io/mcp/guide/',
  cli: 'https://wan2-7.io/cli/',
  pricing: 'https://wan2-7.io/pricing/',
});

const BASE_URL = 'https://wan2-7.io';
const VIDEO_MODELS = ['wan2.7-t2v', 'wan2.7-i2v'];
const IMAGE_MODELS = ['wan2.7-image', 'wan2.7-image-pro'];
const RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4'];
const RESOLUTIONS = ['720p', '1080p', '2K'];
const DEFAULTS = {
  apiKey: '',
  videoModel: 'wan2.7-t2v',
  imageModel: 'wan2.7-image',
  duration: 5,
  resolution: '1080p',
  aspectRatio: '16:9',
  folder: 'wan27',
};

class Wan27Error extends Error {
  constructor(message, kind = 'other', status = 0) {
    super(message);
    this.name = 'Wan27Error';
    this.kind = kind;
    this.status = status;
  }
}

function explain(status, body = {}) {
  const msg = body.error || body.message || `HTTP ${status}`;
  if (status === 401) return new Wan27Error('API token rejected. Configure your token in Settings → Wan 2.7 AI (see https://wan2-7.io/mcp/guide/).', 'auth', status);
  if (status === 402) return new Wan27Error('Insufficient credits on your wan2-7.io account (see https://wan2-7.io/pricing/).', 'quota', status);
  if (status === 403) return new Wan27Error('This model requires an active subscription on https://wan2-7.io/pricing/.', 'plan', status);
  if (status === 409 || status === 429) return new Wan27Error('Another generation is currently in progress or rate-limited.', 'busy', status);
  return new Wan27Error(msg, 'other', status);
}

async function apiCall(method, path, payload, apiKey, base = BASE_URL) {
  const key = (apiKey || '').trim();
  if (!key) {
    throw new Wan27Error('Add your Wan 2.7 API token in Settings → Wan 2.7 AI first (https://wan2-7.io/mcp/guide/).', 'auth', 401);
  }
  const req = {
    url: base.replace(/\/+$/, '') + path,
    method,
    throw: false,
    contentType: 'application/json',
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    },
  };
  if (payload !== undefined && method !== 'GET') {
    req.body = JSON.stringify(payload);
  }
  const res = await requestUrl(req);
  let body = {};
  try {
    body = res.json || {};
  } catch (_e) {
    body = {};
  }
  if (res.status < 200 || res.status >= 300) {
    throw explain(res.status, body);
  }
  return body;
}

async function accountBalance(apiKey, base = BASE_URL) {
  const body = await apiCall('GET', '/api/v1/account/balance', undefined, apiKey, base);
  const credits = body.data?.remainingCredits ?? body.credits ?? 0;
  return Number(credits);
}

async function estimateCredits(prompt, opts = {}) {
  const {
    model = 'wan2.7-t2v',
    resolution = '1080p',
    aspectRatio = '16:9',
    duration = 5,
    apiKey = '',
    base = BASE_URL,
  } = opts;
  const body = await apiCall(
    'POST',
    '/api/v1/credits/estimate',
    { prompt, model, resolution, aspect_ratio: aspectRatio, duration },
    apiKey,
    base
  );
  return Number(body.estimated_credits ?? body.data?.estimatedCredits ?? 0);
}

async function runWan27(prompt, opts = {}) {
  const {
    model = 'wan2.7-t2v',
    resolution = '1080p',
    aspectRatio = '16:9',
    duration = 5,
    imageUrl,
    apiKey = '',
    base = BASE_URL,
    pollEveryMs = 3000,
    maxPolls = 120,
  } = opts;

  const payload = {
    prompt,
    model,
    resolution,
    aspect_ratio: aspectRatio,
    duration,
  };
  if (imageUrl) payload.image_url = imageUrl;

  const start = await apiCall('POST', '/api/v1/generations', payload, apiKey, base);
  const directUrl = start.output_url || start.data?.url || start.data?.videoUrl || start.data?.imageUrl;
  if (directUrl && (start.status === 'completed' || start.status === 'succeeded')) {
    return directUrl;
  }
  const taskId = start.id || start.request_id || start.data?.id;
  if (!taskId) {
    throw new Wan27Error('Wan 2.7 API did not return a task ID.', 'other');
  }

  for (let i = 0; i < maxPolls; i++) {
    if (pollEveryMs > 0) {
      await new Promise((r) => window.setTimeout(r, pollEveryMs));
    }
    const poll = await apiCall('GET', `/api/v1/tasks/${encodeURIComponent(taskId)}`, undefined, apiKey, base);
    const status = poll.status || poll.data?.status;
    const url = poll.output_url || poll.data?.url || poll.data?.videoUrl || poll.data?.imageUrl;
    if ((status === 'completed' || status === 'succeeded') && url) {
      return url;
    }
    if (status === 'failed' || status === 'error') {
      throw new Wan27Error(poll.error || poll.data?.error || 'Generation task failed.', 'failed');
    }
  }
  throw new Wan27Error(`Timed out waiting for task ${taskId}. Check your library on https://wan2-7.io/.`, 'timeout');
}

class PromptModal extends Modal {
  constructor(app, title, defaultModel, onSubmit) {
    super(app);
    this.title = title;
    this.model = defaultModel;
    this.aspectRatio = '16:9';
    this.prompt = '';
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    this.titleEl.setText(this.title);
    new Setting(contentEl)
      .setName('Prompt')
      .setDesc('Describe the video or image to generate (https://wan2-7.io/).')
      .addTextArea((t) => {
        t.inputEl.addClass('wan27-modal-prompt');
        t.onChange((v) => { this.prompt = v; });
      });
    new Setting(contentEl)
      .setName('Aspect ratio')
      .addDropdown((d) => {
        RATIOS.forEach((r) => d.addOption(r, r));
        d.setValue(this.aspectRatio);
        d.onChange((v) => { this.aspectRatio = v; });
      });
    new Setting(contentEl)
      .addButton((b) =>
        b.setButtonText('Generate').setCta().onClick(() => {
          if (!this.prompt.trim()) {
            new Notice('Please enter a prompt.');
            return;
          }
          this.close();
          this.onSubmit(this.prompt.trim(), this.aspectRatio);
        })
      );
  }
  onClose() {
    this.contentEl.empty();
  }
}

class Wan27SettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName('API token')
      .setDesc('Create or manage your token at https://wan2-7.io/mcp/guide/.')
      .addText((t) =>
        t.setPlaceholder('wan27_...')
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (v) => {
            this.plugin.settings.apiKey = v.trim();
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName('Default video model')
      .addDropdown((d) => {
        VIDEO_MODELS.forEach((m) => d.addOption(m, m));
        d.setValue(this.plugin.settings.videoModel);
        d.onChange(async (v) => {
          this.plugin.settings.videoModel = v;
          await this.plugin.saveSettings();
        });
      });
    new Setting(containerEl)
      .setName('Default image model')
      .addDropdown((d) => {
        IMAGE_MODELS.forEach((m) => d.addOption(m, m));
        d.setValue(this.plugin.settings.imageModel);
        d.onChange(async (v) => {
          this.plugin.settings.imageModel = v;
          await this.plugin.saveSettings();
        });
      });
    new Setting(containerEl)
      .setName('Resolution')
      .addDropdown((d) => {
        RESOLUTIONS.forEach((r) => d.addOption(r, r));
        d.setValue(this.plugin.settings.resolution);
        d.onChange(async (v) => {
          this.plugin.settings.resolution = v;
          await this.plugin.saveSettings();
        });
      });
  }
}

class Wan27Plugin extends Plugin {
  async onload() {
    const loaded = (await this.loadData()) || {};
    this.settings = { ...DEFAULTS, ...loaded };
    this.addSettingTab(new Wan27SettingTab(this.app, this));

    this.addCommand({
      id: 'generate-video',
      name: 'Generate video into this note',
      editorCallback: (editor) => {
        new PromptModal(this.app, 'Generate video', this.settings.videoModel, async (prompt, aspectRatio) => {
          try {
            new Notice('Starting video generation…');
            const url = await runWan27(prompt, {
              model: this.settings.videoModel,
              resolution: this.settings.resolution,
              aspectRatio,
              duration: this.settings.duration,
              apiKey: this.settings.apiKey,
            });
            editor.replaceSelection(`\n![Video — ${prompt}](${url})\n`);
            new Notice('Video embedded in note.');
          } catch (e) {
            new Notice(`Generation failed: ${e.message}`);
          }
        }).open();
      },
    });

    this.addCommand({
      id: 'generate-image',
      name: 'Generate image into this note',
      editorCallback: (editor) => {
        new PromptModal(this.app, 'Generate image', this.settings.imageModel, async (prompt, aspectRatio) => {
          try {
            new Notice('Starting image generation…');
            const url = await runWan27(prompt, {
              model: this.settings.imageModel,
              resolution: this.settings.resolution,
              aspectRatio,
              apiKey: this.settings.apiKey,
            });
            editor.replaceSelection(`\n![${prompt}](${url})\n`);
            new Notice('Image embedded in note.');
          } catch (e) {
            new Notice(`Generation failed: ${e.message}`);
          }
        }).open();
      },
    });

    this.addCommand({
      id: 'check-credits',
      name: 'Show remaining credits',
      callback: async () => {
        try {
          const c = await accountBalance(this.settings.apiKey);
          new Notice(`Remaining credits: ${c}`);
        } catch (e) {
          new Notice(`Check failed: ${e.message}`);
        }
      },
    });

    this.addCommand({
      id: 'insert-mcp-config',
      name: 'Insert MCP server configuration block',
      editorCallback: (editor) => {
        const snippet = [
          '```json',
          '{',
          '  "mcpServers": {',
          '    "wan27": {',
          '      "command": "npx",',
          '      "args": ["-y", "@wan27/cli", "mcp"],',
          '      "env": { "WAN27_API_TOKEN": "wan27_your_token_here" }',
          '    }',
          '  }',
          '}',
          '```',
          `> Docs: [Wan 2.7 MCP](${URLS.mcp}) · [Setup Guide](${URLS.mcpGuide}) · [CLI](${URLS.cli}) · [Pricing](${URLS.pricing})`,
        ].join('\n');
        editor.replaceSelection(snippet + '\n');
      },
    });
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

module.exports = Wan27Plugin;
module.exports.runWan27 = runWan27;
module.exports.accountBalance = accountBalance;
module.exports.estimateCredits = estimateCredits;
module.exports.explain = explain;
module.exports.URLS = URLS;
