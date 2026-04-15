const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  loadTeraGrammar,
  tokenizeLinesWithGrammar
} = require('./vscodeGrammarRegistry.cjs');

function findLineNumber(lines, fragment) {
  const index = lines.findIndex((line) => line.includes(fragment));
  if (index === -1) {
    throw new Error(`Unable to find fixture line containing ${fragment}.`);
  }

  return index + 1;
}

function findToken(tokens, predicate, label) {
  const token = tokens.find(predicate);
  assert(token, `Expected to find token for ${label}.`);
  return token;
}

function assertTokenHasScope(token, expectedScope, label) {
  assert(
    token.scopes.includes(expectedScope),
    `Expected ${label} to include scope ${expectedScope}. Received: ${token.scopes.join(', ')}`
  );
}

function assertTokenHasAnyScope(token, expectedScopes, label) {
  assert(
    expectedScopes.some((scope) => token.scopes.includes(scope)),
    `Expected ${label} to include one of ${expectedScopes.join(', ')}. Received: ${token.scopes.join(', ')}`
  );
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const grammarPath = path.join(root, 'syntaxes', 'tera.tmLanguage.json');
  const fixturePath = path.join(root, 'fixtures', 'grammar', 'template-basic.tera');
  const lines = fs.readFileSync(fixturePath, 'utf8').split(/\r?\n/);
  const grammar = await loadTeraGrammar(grammarPath);

  const htmlLine = tokenizeLinesWithGrammar(grammar, lines, findLineNumber(lines, '<div class="shell"'));
  const htmlTag = findToken(htmlLine.tokens, (token) => token.text === 'div', 'template HTML tag');
  assertTokenHasScope(htmlTag, 'entity.name.tag.html', 'template HTML tag');

  const classAttribute = findToken(htmlLine.tokens, (token) => token.text === 'class', 'template attribute');
  assertTokenHasScope(classAttribute, 'entity.other.attribute-name.html', 'template attribute');

  const directiveAttribute = findToken(htmlLine.tokens, (token) => token.text === ':data-state', 'template directive attribute');
  assertTokenHasScope(directiveAttribute, 'entity.other.attribute-name.html', 'template directive attribute');

  const htmlStringValue = findToken(htmlLine.tokens, (token) => token.text.includes('shell'), 'template attribute string');
  assertTokenHasScope(htmlStringValue, 'string.quoted.double.html', 'template attribute string');

  const componentLine = tokenizeLinesWithGrammar(grammar, lines, findLineNumber(lines, '<DevtoolsEmbed mode="inline"'));
  const componentTag = findToken(componentLine.tokens, (token) => token.text === 'DevtoolsEmbed', 'component tag');
  assertTokenHasScope(componentTag, 'entity.name.tag.html.tera', 'component tag');

  const interpolationLine = tokenizeLinesWithGrammar(grammar, lines, findLineNumber(lines, '{{ count + 1 }}'));
  const interpolationOpen = findToken(interpolationLine.tokens, (token) => token.text === '{{', 'interpolation opening');
  assertTokenHasScope(interpolationOpen, 'punctuation.section.embedded.begin.tera', 'interpolation opening');

  const interpolationIdentifier = findToken(interpolationLine.tokens, (token) => token.text === 'count', 'interpolation identifier');
  assertTokenHasScope(interpolationIdentifier, 'variable.other.readwrite.ts', 'interpolation identifier');

  const scriptLine = tokenizeLinesWithGrammar(grammar, lines, findLineNumber(lines, 'const count = 1;'));
  const scriptKeyword = findToken(scriptLine.tokens, (token) => token.text === 'const', 'script keyword');
  assertTokenHasScope(scriptKeyword, 'storage.type.ts', 'script keyword');

  const styleLine = tokenizeLinesWithGrammar(grammar, lines, findLineNumber(lines, '.shell { color: red; }'));
  const colorKeyword = findToken(styleLine.tokens, (token) => token.text === 'red', 'style color keyword');
  assertTokenHasScope(colorKeyword, 'support.constant.color.w3c-standard-color-name.css', 'style color keyword');

  console.log('Grammar regression checks passed.');
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});