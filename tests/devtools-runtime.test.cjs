const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const { after, test } = require('node:test');
const Module = require('node:module');
const path = require('node:path');

class FakeLanguageModelError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }

  static NoPermissions = { name: 'NoPermissions' };
  static Blocked = { name: 'Blocked' };
  static NotFound = { name: 'NotFound' };
}

const modelState = {
  lastRequest: null,
  models: []
};

const vscodeMock = {
  LanguageModelError: FakeLanguageModelError,
  LanguageModelChatMessage: {
    User(prompt) {
      return {
        role: 'user',
        content: prompt
      };
    }
  },
  lm: {
    async selectChatModels() {
      return modelState.models;
    }
  }
};

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'vscode') {
    return vscodeMock;
  }

  return originalLoad.call(this, request, parent, isMain);
};

after(() => {
  Module._load = originalLoad;
});

const root = path.resolve(__dirname, '..');
const distRoot = path.join(root, 'dist');

const {
  clearAutoAttachMetadata,
  resolveAutoAttachMetadataFilePath,
  writeAutoAttachMetadata
} = require(path.join(distRoot, 'devtools', 'live', 'autoAttachMetadata.js'));
const { renderSessionHtml } = require(path.join(distRoot, 'devtools', 'session', 'html.js'));
const { tryParseDevtoolsSession } = require(path.join(distRoot, 'devtools', 'session', 'parsing.js'));
const { buildLiveAttachSnippet } = require(path.join(distRoot, 'devtools', 'live', 'attachSnippet.js'));
const { createLiveReceiverServer } = require(path.join(distRoot, 'devtools', 'live', 'server.js'));

function createSampleSessionExport() {
  const timestamp = 1713120000000;
  const codeReference = {
    file: 'src/components/DevtoolsEmbed.tera',
    line: 12,
    column: 4,
    summary: 'Inspect the effect that refreshes the live diagnostics panel.',
    eventType: 'error:component',
    level: 'error',
    timestamp
  };

  return {
    snapshot: {
      instanceId: 'instance-1',
      hostKind: 'browser',
      hostId: 'devtools-host',
      activeTab: 'ai',
      theme: 'dark',
      eventCount: 1,
      mountedComponentCount: 1,
      selectedComponentKey: 'DevtoolsEmbed',
      selectedMetaKey: null,
      componentSearchQuery: '',
      componentInspectorQuery: '',
      ai: {
        status: 'ready',
        likelyCause: 'A reactive effect is retriggering on every live update.',
        error: null,
        promptAvailable: true,
        responseAvailable: true,
        assistantEnabled: true,
        assistantEndpoint: null,
        assistantModel: 'VS Code AI/Copilot',
        assistantTimeoutMs: 12000
      },
      layout: {
        position: 'right',
        panelSize: 'default',
        persistPreferences: true
      },
      codeReferences: [codeReference],
      document: {
        title: 'Devtools Embed',
        lang: 'en',
        dir: 'ltr',
        path: '/devtools',
        hash: null,
        queryKeys: ['mode'],
        metaTagCount: 1,
        linkTagCount: 1
      },
      documentDiagnostics: [
        {
          id: 'missing-description',
          severity: 'warn',
          message: 'Description metadata is missing.',
          detail: 'Add a description meta tag for exported diagnostics pages.'
        }
      ],
      recentEvents: [
        {
          type: 'ai:assistant:request',
          timestamp,
          level: 'info'
        }
      ]
    },
    codeReferences: [codeReference],
    document: {
      title: 'Devtools Embed',
      lang: 'en',
      dir: 'ltr',
      path: '/devtools',
      hash: null,
      queryKeys: ['mode'],
      metaTags: [
        {
          key: 'description',
          source: 'meta:name',
          value: 'Live diagnostics session page.'
        }
      ],
      linkTags: [
        {
          rel: 'canonical',
          href: 'https://example.com/devtools',
          sameOrigin: false,
          queryKeys: []
        }
      ]
    },
    documentDiagnostics: [
      {
        id: 'missing-description',
        severity: 'warn',
        message: 'Description metadata is missing.',
        detail: 'Add a description meta tag for exported diagnostics pages.'
      }
    ],
    events: [
      {
        type: 'error:component',
        timestamp,
        level: 'error',
        file: 'src/components/DevtoolsEmbed.tera',
        line: 12,
        column: 4,
        payload: {
          message: 'Live diagnostics loop'
        }
      }
    ]
  };
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to resolve test server address.');
  }

  return `http://127.0.0.1:${address.port}`;
}

async function close(server) {
  await new Promise((resolve) => {
    server.close(() => resolve());
  });
}

test('parses exported sessions and renders the static inspector html', () => {
  const parsed = tryParseDevtoolsSession(JSON.stringify(createSampleSessionExport()));
  assert.ok(parsed, 'Expected the exported session to parse.');
  assert.equal(parsed.snapshot.instanceId, 'instance-1');
  assert.equal(parsed.codeReferences[0].file, 'src/components/DevtoolsEmbed.tera');

  const html = renderSessionHtml(parsed, 'clipboard', {
    enableCodeReferenceActions: true,
    scriptNonce: 'nonce123'
  });

  assert.match(html, /Terajs DevTools Session/);
  assert.match(html, /Imported from clipboard/);
  assert.match(html, /Devtools Embed/);
  assert.match(html, /open-code-reference/);
  assert.match(html, /nonce="nonce123"/);
});

test('builds a live attach snippet that installs the VS Code AI bridge', () => {
  const snippet = buildLiveAttachSnippet({
    session: 'http://127.0.0.1:40123/live/test-token',
    ai: 'http://127.0.0.1:40123/ai/test-token'
  });

  assert.match(snippet, /__TERAJS_VSCODE_AI_ASSISTANT__/);
  assert.match(snippet, /VS Code AI\/Copilot/);
  assert.match(snippet, /terajs:devtools:extension-ai-bridge:change/);
  assert.match(snippet, /http:\/\/127\.0\.0\.1:40123\/live\/test-token/);
  assert.match(snippet, /http:\/\/127\.0\.0\.1:40123\/ai\/test-token/);
});

test('writes and clears auto-attach metadata for Terajs workspaces', () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'terajs-auto-attach-'));
  const otherRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'terajs-auto-attach-other-'));

  try {
    fs.writeFileSync(path.join(workspaceRoot, 'terajs.config.cjs'), 'module.exports = {};', 'utf8');

    const writtenPaths = writeAutoAttachMetadata([workspaceRoot, otherRoot], {
      session: 'http://127.0.0.1:4000/live/token',
      ai: 'http://127.0.0.1:4000/ai/token'
    });

    assert.equal(writtenPaths.length, 1);

    const metadataPath = resolveAutoAttachMetadataFilePath(workspaceRoot);
    assert.equal(writtenPaths[0], metadataPath);
    assert.ok(fs.existsSync(metadataPath));

    const payload = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    assert.equal(payload.version, 1);
    assert.equal(payload.session, 'http://127.0.0.1:4000/live/token');
    assert.equal(payload.ai, 'http://127.0.0.1:4000/ai/token');

    clearAutoAttachMetadata([workspaceRoot, otherRoot]);
    assert.equal(fs.existsSync(metadataPath), false);
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
    fs.rmSync(otherRoot, { recursive: true, force: true });
  }
});

test('accepts live session payloads and serves AI bridge requests', async () => {
  modelState.lastRequest = null;
  modelState.models = [
    {
      vendor: 'copilot',
      family: 'gpt-5.4',
      version: 'test',
      name: 'GPT-5.4',
      id: 'copilot/test',
      async sendRequest(messages, options) {
        modelState.lastRequest = { messages, options };

        return {
          text: (async function* streamResponse() {
            yield '{"summary":"Live bridge ok","likelyCauses":["The live attach path is receiving the current diagnostics bundle."],"codeReferences":[],"nextChecks":["Keep the live session attached while reproducing the issue."],"suggestedFixes":["Use the live bridge to compare runtime changes before and after the failing action."]}';
          })()
        };
      }
    }
  ];

  const context = {
    languageModelAccessInformation: {
      canSendRequest() {
        return true;
      }
    }
  };

  let receivedPayload = null;
  const server = createLiveReceiverServer(context, 'test-token', (payload) => {
    receivedPayload = payload;
  });
  const baseUrl = await listen(server);

  try {
    const sessionExport = createSampleSessionExport();
    const liveResponse = await fetch(`${baseUrl}/live/test-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8'
      },
      body: JSON.stringify({
        phase: 'ready',
        session: sessionExport
      })
    });

    assert.equal(liveResponse.status, 202);
    assert.ok(receivedPayload, 'Expected the live payload callback to run.');
    assert.equal(receivedPayload.phase, 'ready');
    assert.equal(receivedPayload.session.snapshot.instanceId, 'instance-1');

    const aiResponse = await fetch(`${baseUrl}/ai/test-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8'
      },
      body: JSON.stringify({
        prompt: 'Explain the current DevTools runtime failure.'
      })
    });

    assert.equal(aiResponse.status, 200);
    const aiBody = await aiResponse.json();
    assert.equal(aiBody.telemetry.endpoint, null);
    assert.match(aiBody.telemetry.model, /copilot\/gpt-5\.4\/test/);
    assert.match(aiBody.response, /Live bridge ok/);

    assert.ok(modelState.lastRequest, 'Expected a language model request to be recorded.');
    assert.deepEqual(modelState.lastRequest.messages, [
      {
        role: 'user',
        content: 'Explain the current DevTools runtime failure.'
      }
    ]);
    assert.match(modelState.lastRequest.options.justification, /sanitized Terajs DevTools session/);

    const invalidAiResponse = await fetch(`${baseUrl}/ai/test-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8'
      },
      body: JSON.stringify({
        prompt: '   '
      })
    });

    assert.equal(invalidAiResponse.status, 400);
  } finally {
    await close(server);
  }
});