const fs = require('node:fs');
const path = require('node:path');
const { Registry } = require('vscode-textmate');
const oniguruma = require('vscode-oniguruma');

let bundledGrammarPaths = null;
let onigurumaPromise = null;
const jsonCache = new Map();
const grammarCache = new Map();

function resolveVSCodeBaseDirectories() {
  return [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code Insiders'),
    path.join(process.env.ProgramFiles || '', 'Microsoft VS Code'),
    path.join(process.env.ProgramFiles || '', 'Microsoft VS Code Insiders'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft VS Code'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft VS Code Insiders')
  ].filter((candidate) => candidate && fs.existsSync(candidate));
}

function resolveBundledExtensionsRoot() {
  const bases = resolveVSCodeBaseDirectories();

  for (const base of bases) {
    const directPath = path.join(base, 'resources', 'app', 'extensions');
    if (fs.existsSync(directPath)) {
      return directPath;
    }

    const children = fs.readdirSync(base, { withFileTypes: true });
    for (const child of children) {
      if (!child.isDirectory() || !/^[0-9a-f]{10}$/i.test(child.name)) {
        continue;
      }

      const versionedPath = path.join(base, child.name, 'resources', 'app', 'extensions');
      if (fs.existsSync(versionedPath)) {
        return versionedPath;
      }
    }
  }

  throw new Error('Unable to locate the bundled VS Code grammar directory.');
}

function addBundledGrammar(mapping, extensionsRoot, scopeName, relativePath) {
  const absolutePath = path.join(extensionsRoot, relativePath);
  if (fs.existsSync(absolutePath)) {
    mapping.set(scopeName, absolutePath);
  }
}

function resolveBundledGrammarPaths() {
  if (bundledGrammarPaths) {
    return bundledGrammarPaths;
  }

  const extensionsRoot = resolveBundledExtensionsRoot();
  const mapping = new Map();
  addBundledGrammar(mapping, extensionsRoot, 'text.html.basic', path.join('html', 'syntaxes', 'html.tmLanguage.json'));
  addBundledGrammar(mapping, extensionsRoot, 'text.html.derivative', path.join('html', 'syntaxes', 'html-derivative.tmLanguage.json'));
  addBundledGrammar(mapping, extensionsRoot, 'source.ts', path.join('typescript-basics', 'syntaxes', 'TypeScript.tmLanguage.json'));
  addBundledGrammar(mapping, extensionsRoot, 'source.js', path.join('javascript', 'syntaxes', 'JavaScript.tmLanguage.json'));
  addBundledGrammar(mapping, extensionsRoot, 'source.css', path.join('css', 'syntaxes', 'css.tmLanguage.json'));
  bundledGrammarPaths = mapping;
  return mapping;
}

function readJsonFile(filePath) {
  if (!jsonCache.has(filePath)) {
    jsonCache.set(filePath, JSON.parse(fs.readFileSync(filePath, 'utf8')));
  }

  return jsonCache.get(filePath);
}

async function getOnigurumaLibrary() {
  if (!onigurumaPromise) {
    onigurumaPromise = (async () => {
      const wasmPath = require.resolve('vscode-oniguruma/release/onig.wasm');
      const wasm = fs.readFileSync(wasmPath).buffer;
      await oniguruma.loadWASM(wasm);
      return {
        createOnigScanner(patterns) {
          return new oniguruma.OnigScanner(patterns);
        },
        createOnigString(text) {
          return new oniguruma.OnigString(text);
        }
      };
    })();
  }

  return onigurumaPromise;
}

async function loadGrammarDefinition(scopeName, teraGrammarPath) {
  if (scopeName === 'text.html.tera') {
    return readJsonFile(teraGrammarPath);
  }

  const bundledPath = resolveBundledGrammarPaths().get(scopeName);
  return bundledPath ? readJsonFile(bundledPath) : null;
}

async function loadTeraGrammar(teraGrammarPath) {
  const normalizedPath = path.resolve(teraGrammarPath);
  if (!grammarCache.has(normalizedPath)) {
    const registry = new Registry({
      onigLib: getOnigurumaLibrary(),
      loadGrammar: (scopeName) => loadGrammarDefinition(scopeName, normalizedPath)
    });

    grammarCache.set(normalizedPath, registry.loadGrammar('text.html.tera').then((grammar) => {
      if (!grammar) {
        throw new Error(`Failed to load the Terajs grammar from ${normalizedPath}.`);
      }

      return grammar;
    }));
  }

  return grammarCache.get(normalizedPath);
}

function tokenizeLinesWithGrammar(grammar, lines, sampleLineNumber) {
  let ruleStack = null;
  let result = null;
  let line = '';

  for (let index = 0; index < sampleLineNumber; index += 1) {
    line = lines[index] ?? '';
    result = grammar.tokenizeLine(line, ruleStack);
    ruleStack = result.ruleStack;
  }

  if (!result) {
    throw new Error('No tokenization result produced.');
  }

  return {
    lineNumber: sampleLineNumber,
    line,
    tokens: result.tokens.map((token) => ({
      startIndex: token.startIndex,
      endIndex: token.endIndex,
      text: line.slice(token.startIndex, token.endIndex),
      scopes: token.scopes
    }))
  };
}

async function tokenizeFileLine({ grammarPath, filePath, sampleLineNumber }) {
  const grammar = await loadTeraGrammar(grammarPath);
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  return tokenizeLinesWithGrammar(grammar, lines, sampleLineNumber);
}

module.exports = {
  loadTeraGrammar,
  resolveBundledGrammarPaths,
  tokenizeFileLine,
  tokenizeLinesWithGrammar
};