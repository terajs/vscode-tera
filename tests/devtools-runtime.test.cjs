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
  buildAttachedSiteChatMessages,
  buildAttachedSiteChatQuery,
  TERAJS_CHAT_PARTICIPANT_NAME
} = require(path.join(distRoot, 'devtools', 'ai', 'chatPrompts.js'));
const {
  buildRouteFileCandidates,
  extractCapitalizedComponentNames,
  extractRelativeImports,
  formatAttachedSiteWorkspaceEvidence
} = require(path.join(distRoot, 'devtools', 'ai', 'workspaceEvidence.js'));
const {
  buildAttachedSiteDiagnosticsPayload
} = require(path.join(distRoot, 'devtools', 'ai', 'attachedSiteDiagnostics.js'));
const {
  clearAutoAttachMetadata,
  resolveAutoAttachMetadataFilePath,
  resolveGlobalAutoAttachMetadataFilePath,
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
        summary: 'Automatic VS Code diagnosis completed for the current live session.',
        likelyCauses: [
          'A route-level effect is re-entering while the current session is connected.'
        ],
        nextChecks: [
          'Inspect the first effect that writes during route activation.'
        ],
        suggestedFixes: [
          'Guard the effect or move the write behind an explicit user action.'
        ],
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

function padAsciiBody(body, targetBytes) {
  const bodyBytes = Buffer.byteLength(body, 'utf8');
  if (bodyBytes >= targetBytes) {
    return body;
  }

  return body + ' '.repeat(targetBytes - bodyBytes);
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
  assert.match(html, /Automatic VS Code diagnosis completed for the current live session/);
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

test('builds a bounded tool payload from the latest attached site session', () => {
  const session = createSampleSessionExport();
  session.events.push({
    type: 'route:navigate',
    timestamp: 1713120000500,
    level: 'info',
    payload: {
      to: '/docs'
    }
  });

  const payload = buildAttachedSiteDiagnosticsPayload({
    server: null,
    token: 'test-token',
    endpoints: {
      session: 'http://127.0.0.1:40123/live/test-token',
      ai: 'http://127.0.0.1:40123/ai/test-token',
      reveal: 'http://127.0.0.1:40123/reveal/test-token'
    },
    panel: null,
    latestSession: session,
    connectionState: 'connected',
    connectedAt: 1713120000000,
    lastSessionInstanceId: session.snapshot.instanceId,
    lastUpdateAt: 1713120000500,
    lastPhase: 'update'
  }, {
    eventLimit: 1
  });

  assert.equal(payload.source, 'terajs-devtools-service-bridge');
  assert.equal(payload.receiver.connected, true);
  assert.equal(payload.session.totalEventCount, 2);
  assert.equal(payload.session.recentEvents.length, 1);
  assert.equal(payload.session.recentEvents[0].type, 'route:navigate');
  assert.equal('payload' in payload.session.recentEvents[0], false);
});

test('can include recent event payloads in the attached site tool payload', () => {
  const session = createSampleSessionExport();
  const payload = buildAttachedSiteDiagnosticsPayload({
    server: null,
    token: 'test-token',
    endpoints: {
      session: 'http://127.0.0.1:40123/live/test-token',
      ai: 'http://127.0.0.1:40123/ai/test-token',
      reveal: 'http://127.0.0.1:40123/reveal/test-token'
    },
    panel: null,
    latestSession: session,
    connectionState: 'waiting',
    connectedAt: null,
    lastSessionInstanceId: session.snapshot.instanceId,
    lastUpdateAt: 1713120000000,
    lastPhase: 'dispose'
  }, {
    includeEventPayloads: true,
    eventLimit: 5
  });

  assert.match(payload.message, /last sanitized Terajs snapshot/i);
  assert.deepEqual(payload.session.recentEvents[0].payload, {
    message: 'Live diagnostics loop'
  });
});

test('builds Terajs chat messages for attached-site inspection', () => {
  const session = createSampleSessionExport();
  const payload = buildAttachedSiteDiagnosticsPayload({
    server: null,
    token: 'test-token',
    endpoints: {
      session: 'http://127.0.0.1:40123/live/test-token',
      ai: 'http://127.0.0.1:40123/ai/test-token',
      reveal: 'http://127.0.0.1:40123/reveal/test-token'
    },
    panel: null,
    latestSession: session,
    connectionState: 'connected',
    connectedAt: 1713120000000,
    lastSessionInstanceId: session.snapshot.instanceId,
    lastUpdateAt: 1713120000500,
    lastPhase: 'ready'
  });

  const messages = buildAttachedSiteChatMessages(
    payload,
    '',
    'inspect',
    formatAttachedSiteWorkspaceEvidence({
      routePath: '/',
      files: [
        {
          path: 'src/pages/index.tera',
          reason: 'Active route shell for /',
          excerpt: '  1: <template>\n  2:   <section />'
        }
      ]
    })
  );

  assert.equal(messages.length, 4);
  assert.match(messages[0].content, /Terajs attached-site inspector/);
  assert.match(messages[0].content, /label file suspects as hypotheses/);
  assert.match(messages[0].content, /Do not pad metadata-only diagnoses with unrelated components/);
  assert.match(messages[1].content, /Attached Terajs site snapshot/);
  assert.match(messages[2].content, /Attached workspace evidence for route: \//);
  assert.match(messages[3].content, /Inspect the currently attached Terajs site/);
});

test('builds the Terajs chat query for inspect entrypoints', () => {
  assert.equal(TERAJS_CHAT_PARTICIPANT_NAME, 'terajs');
  assert.equal(buildAttachedSiteChatQuery(), '@terajs /inspect');
  assert.equal(buildAttachedSiteChatQuery('events'), '@terajs /events');
});

test('builds likely route file candidates from attached page paths', () => {
  assert.deepEqual(buildRouteFileCandidates('/'), ['src/pages/index.tera']);
  assert.deepEqual(buildRouteFileCandidates('/docs/quickstart'), [
    'src/pages/docs/quickstart.tera',
    'src/pages/docs/quickstart/index.tera'
  ]);
});

test('extracts likely component tags and relative imports from tera files', () => {
  const source = [
    '<template>',
    '  <SiteHeader />',
    '  <ContentPage />',
    '</template>',
    '<script>',
    'import { docsPages } from "../../content/docs.ts"',
    'import DemoCard from "../components/DemoCard.tera"',
    '</script>'
  ].join('\n');

  assert.deepEqual(extractCapitalizedComponentNames(source), ['SiteHeader', 'ContentPage']);
  assert.deepEqual(extractRelativeImports(source), ['../../content/docs.ts', '../components/DemoCard.tera']);
});

test('writes and clears auto-attach metadata for Terajs workspaces', () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'terajs-auto-attach-'));
  const otherRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'terajs-auto-attach-other-'));
  const previousManifestOverride = process.env.TERAJS_DEVTOOLS_BRIDGE_MANIFEST_PATH;
  process.env.TERAJS_DEVTOOLS_BRIDGE_MANIFEST_PATH = path.join(os.tmpdir(), `terajs-auto-attach-global-${Date.now()}`, 'devtools-bridge.json');

  try {
    fs.writeFileSync(path.join(workspaceRoot, 'terajs.config.cjs'), 'module.exports = {};', 'utf8');

    const writtenPaths = writeAutoAttachMetadata([workspaceRoot, otherRoot], {
      session: 'http://127.0.0.1:4000/live/token',
      ai: 'http://127.0.0.1:4000/ai/token',
      reveal: 'http://127.0.0.1:4000/reveal/token'
    });

    assert.equal(writtenPaths.length, 2);

    const metadataPath = resolveAutoAttachMetadataFilePath(workspaceRoot);
    const globalMetadataPath = resolveGlobalAutoAttachMetadataFilePath();
    assert.ok(writtenPaths.includes(metadataPath));
    assert.ok(writtenPaths.includes(globalMetadataPath));
    assert.ok(fs.existsSync(metadataPath));
    assert.ok(fs.existsSync(globalMetadataPath));

    const payload = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    assert.equal(payload.version, 1);
    assert.equal(payload.session, 'http://127.0.0.1:4000/live/token');
    assert.equal(payload.ai, 'http://127.0.0.1:4000/ai/token');
    assert.equal(payload.reveal, 'http://127.0.0.1:4000/reveal/token');

    const globalPayload = JSON.parse(fs.readFileSync(globalMetadataPath, 'utf8'));
    assert.equal(globalPayload.version, 1);
    assert.equal(globalPayload.session, 'http://127.0.0.1:4000/live/token');
    assert.equal(globalPayload.ai, 'http://127.0.0.1:4000/ai/token');
    assert.equal(globalPayload.reveal, 'http://127.0.0.1:4000/reveal/token');

    clearAutoAttachMetadata([workspaceRoot, otherRoot], {
      session: 'http://127.0.0.1:4000/live/token',
      ai: 'http://127.0.0.1:4000/ai/token',
      reveal: 'http://127.0.0.1:4000/reveal/token'
    });
    assert.equal(fs.existsSync(metadataPath), false);
    assert.equal(fs.existsSync(globalMetadataPath), false);
  } finally {
    if (previousManifestOverride === undefined) {
      delete process.env.TERAJS_DEVTOOLS_BRIDGE_MANIFEST_PATH;
    } else {
      process.env.TERAJS_DEVTOOLS_BRIDGE_MANIFEST_PATH = previousManifestOverride;
    }
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
    fs.rmSync(otherRoot, { recursive: true, force: true });
  }
});

test('preserves newer global auto-attach metadata owned by another receiver', () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'terajs-auto-attach-owned-'));
  const previousManifestOverride = process.env.TERAJS_DEVTOOLS_BRIDGE_MANIFEST_PATH;
  process.env.TERAJS_DEVTOOLS_BRIDGE_MANIFEST_PATH = path.join(os.tmpdir(), `terajs-auto-attach-owned-global-${Date.now()}`, 'devtools-bridge.json');

  try {
    fs.writeFileSync(path.join(workspaceRoot, 'terajs.config.cjs'), 'module.exports = {};', 'utf8');

    writeAutoAttachMetadata([workspaceRoot], {
      session: 'http://127.0.0.1:4100/live/first',
      ai: 'http://127.0.0.1:4100/ai/first',
      reveal: 'http://127.0.0.1:4100/reveal/first'
    });

    writeAutoAttachMetadata([workspaceRoot], {
      session: 'http://127.0.0.1:4200/live/second',
      ai: 'http://127.0.0.1:4200/ai/second',
      reveal: 'http://127.0.0.1:4200/reveal/second'
    });

    const globalMetadataPath = resolveGlobalAutoAttachMetadataFilePath();
    clearAutoAttachMetadata([workspaceRoot], {
      session: 'http://127.0.0.1:4100/live/first',
      ai: 'http://127.0.0.1:4100/ai/first',
      reveal: 'http://127.0.0.1:4100/reveal/first'
    });

    assert.equal(fs.existsSync(globalMetadataPath), true);

    const globalPayload = JSON.parse(fs.readFileSync(globalMetadataPath, 'utf8'));
    assert.equal(globalPayload.session, 'http://127.0.0.1:4200/live/second');
    assert.equal(globalPayload.ai, 'http://127.0.0.1:4200/ai/second');
    assert.equal(globalPayload.reveal, 'http://127.0.0.1:4200/reveal/second');
  } finally {
    if (previousManifestOverride === undefined) {
      delete process.env.TERAJS_DEVTOOLS_BRIDGE_MANIFEST_PATH;
    } else {
      process.env.TERAJS_DEVTOOLS_BRIDGE_MANIFEST_PATH = previousManifestOverride;
    }
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
    fs.rmSync(path.dirname(resolveGlobalAutoAttachMetadataFilePath()), { recursive: true, force: true });
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
    return {
      accepted: true,
      phase: payload.phase,
      state: 'connected',
      connectedAt: 1713120005000,
      instanceId: payload.session.snapshot.instanceId
    };
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
    const liveBody = await liveResponse.json();
    assert.equal(liveBody.accepted, true);
    assert.equal(liveBody.phase, 'ready');
    assert.equal(liveBody.state, 'connected');
    assert.equal(liveBody.instanceId, 'instance-1');
    assert.equal(typeof liveBody.connectedAt, 'number');
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

test('accepts live session payloads above the previous receiver limit', async () => {
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
    return {
      accepted: true,
      phase: payload.phase,
      state: 'connected',
      connectedAt: 1713120005000,
      instanceId: payload.session.snapshot.instanceId
    };
  }, () => {});
  const baseUrl = await listen(server);

  try {
    const payload = padAsciiBody(JSON.stringify({
      phase: 'ready',
      session: createSampleSessionExport()
    }), 1_600_000);

    const response = await fetch(`${baseUrl}/live/test-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8'
      },
      body: payload
    });

    assert.equal(response.status, 202);
    assert.ok(receivedPayload, 'Expected the large live payload callback to run.');
    assert.equal(receivedPayload.session.snapshot.instanceId, 'instance-1');
  } finally {
    await close(server);
  }
});

test('returns 413 for oversized live session payloads without resetting the connection', async () => {
  const context = {
    languageModelAccessInformation: {
      canSendRequest() {
        return true;
      }
    }
  };

  const server = createLiveReceiverServer(context, 'test-token', () => {
    throw new Error('Expected oversized payloads to be rejected before session handling.');
  }, () => {});
  const baseUrl = await listen(server);

  try {
    const payload = padAsciiBody(JSON.stringify({
      phase: 'ready',
      session: createSampleSessionExport()
    }), 5_100_000);

    const response = await fetch(`${baseUrl}/live/test-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8'
      },
      body: payload
    });

    assert.equal(response.status, 413);
    assert.equal(await response.text(), 'payload too large');
  } finally {
    await close(server);
  }
});