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

function tokenScopeMatches(expectedScope, actualScope) {
  return actualScope === expectedScope || actualScope.startsWith(`${expectedScope}.`);
}

function assertTokenHasScope(token, expectedScope, label) {
  assert(
    token.scopes.some((scope) => tokenScopeMatches(expectedScope, scope)),
    `Expected ${label} to include scope ${expectedScope}. Received: ${token.scopes.join(', ')}`
  );
}

function assertTokenHasAnyScope(token, expectedScopes, label) {
  assert(
    expectedScopes.some((scope) => token.scopes.includes(scope)),
    `Expected ${label} to include one of ${expectedScopes.join(', ')}. Received: ${token.scopes.join(', ')}`
  );
}

function assertTokenIncludesExactScope(token, expectedScope, label) {
  assert(
    token.scopes.includes(expectedScope),
    `Expected ${label} to include exact scope ${expectedScope}. Received: ${token.scopes.join(', ')}`
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
  assertTokenIncludesExactScope(htmlTag, 'entity.name.tag.html', 'template HTML tag');

  const templateBlockLine = tokenizeLinesWithGrammar(grammar, lines, findLineNumber(lines, '<template>'));
  const templateBlockOpen = findToken(templateBlockLine.tokens, (token) => token.text === '<', 'template block opening bracket');
  const templateBlockTag = findToken(templateBlockLine.tokens, (token) => token.text === 'template', 'template block tag');
  const templateBlockClose = findToken(templateBlockLine.tokens, (token) => token.text === '>', 'template block closing bracket');
  assertTokenIncludesExactScope(templateBlockOpen, 'punctuation.definition.tag.begin.html', 'template block opening bracket');
  assertTokenIncludesExactScope(templateBlockTag, 'entity.name.tag.template.html.tera', 'template block tag');
  assertTokenIncludesExactScope(templateBlockClose, 'punctuation.definition.tag.end.html', 'template block closing bracket');

  const classAttribute = findToken(htmlLine.tokens, (token) => token.text === 'class', 'template attribute');
  assertTokenIncludesExactScope(classAttribute, 'entity.other.attribute-name.html', 'template attribute');

  const directiveAttribute = findToken(htmlLine.tokens, (token) => token.text === ':data-state', 'template directive attribute');
  assertTokenIncludesExactScope(directiveAttribute, 'entity.other.attribute-name.html', 'template directive attribute');

  const htmlStringValue = findToken(htmlLine.tokens, (token) => token.text.includes('shell'), 'template attribute string');
  assertTokenIncludesExactScope(htmlStringValue, 'string.quoted.double.html', 'template attribute string');

  const componentLine = tokenizeLinesWithGrammar(grammar, lines, findLineNumber(lines, '<DevtoolsEmbed mode="inline"'));
  const componentTag = findToken(componentLine.tokens, (token) => token.text === 'DevtoolsEmbed', 'component tag');
  assertTokenIncludesExactScope(componentTag, 'entity.name.tag.html', 'component tag');
  assertTokenIncludesExactScope(componentTag, 'support.class.component.html.tera', 'component tag');

  const componentAttribute = findToken(componentLine.tokens, (token) => token.text === 'mode', 'component attribute');
  assertTokenIncludesExactScope(componentAttribute, 'entity.other.attribute-name.html', 'component attribute');

  const componentStringValue = findToken(componentLine.tokens, (token) => token.text.includes('inline'), 'component attribute string');
  assertTokenIncludesExactScope(componentStringValue, 'string.quoted.double.html', 'component attribute string');

  const directiveLine = tokenizeLinesWithGrammar(grammar, lines, findLineNumber(lines, '<site-preview v-if="count > 0" v-for="item in items" :class="item.className" />'));
  const kebabComponentTag = findToken(directiveLine.tokens, (token) => token.text === 'site-preview', 'kebab component tag');
  assertTokenIncludesExactScope(kebabComponentTag, 'entity.name.tag.html', 'kebab component tag');
  assertTokenIncludesExactScope(kebabComponentTag, 'support.class.component.html.tera', 'kebab component tag');

  const ifDirective = findToken(directiveLine.tokens, (token) => token.text === 'v-if', 'v-if directive');
  assertTokenIncludesExactScope(ifDirective, 'keyword.control.conditional.tera', 'v-if directive');

  const ifDirectiveIdentifier = findToken(directiveLine.tokens, (token) => token.text === 'count', 'v-if expression identifier');
  assertTokenHasScope(ifDirectiveIdentifier, 'variable.other.readwrite.ts', 'v-if expression identifier');

  const forDirective = findToken(directiveLine.tokens, (token) => token.text === 'v-for', 'v-for directive');
  assertTokenIncludesExactScope(forDirective, 'keyword.control.loop.tera', 'v-for directive');

  const classDirective = findToken(directiveLine.tokens, (token) => token.text === ':class', 'bind class directive');
  assertTokenIncludesExactScope(classDirective, 'entity.other.attribute-name.html', 'bind class directive');

  const classDirectiveIdentifier = findToken(directiveLine.tokens, (token) => token.text === 'item', 'bind class expression identifier');
  assertTokenHasScope(classDirectiveIdentifier, 'variable.other.readwrite.ts', 'bind class expression identifier');

  const interpolationLine = tokenizeLinesWithGrammar(grammar, lines, findLineNumber(lines, '{{ count + 1 }}'));
  const interpolationOpen = findToken(interpolationLine.tokens, (token) => token.text === '{{', 'interpolation opening');
  assertTokenHasScope(interpolationOpen, 'punctuation.section.embedded.begin.tera', 'interpolation opening');

  const interpolationIdentifier = findToken(interpolationLine.tokens, (token) => token.text === 'count', 'interpolation identifier');
  assertTokenHasScope(interpolationIdentifier, 'variable.other.readwrite.ts', 'interpolation identifier');

  const scriptLine = tokenizeLinesWithGrammar(grammar, lines, findLineNumber(lines, 'const count = 1;'));
  const scriptKeyword = findToken(scriptLine.tokens, (token) => token.text === 'const', 'script keyword');
  assertTokenHasScope(scriptKeyword, 'storage.type.ts', 'script keyword');

  const scriptBlockLine = tokenizeLinesWithGrammar(grammar, lines, findLineNumber(lines, '<script lang="ts">'));
  const scriptBlockOpen = findToken(scriptBlockLine.tokens, (token) => token.text === '<', 'script block opening bracket');
  const scriptBlockTag = findToken(scriptBlockLine.tokens, (token) => token.text === 'script', 'script block tag');
  const scriptBlockClose = findToken(scriptBlockLine.tokens, (token) => token.text === '>', 'script block closing bracket');
  assertTokenIncludesExactScope(scriptBlockOpen, 'punctuation.definition.tag.begin.html', 'script block opening bracket');
  assertTokenIncludesExactScope(scriptBlockTag, 'entity.name.tag.script.html.tera', 'script block tag');

  const scriptLangAttribute = findToken(scriptBlockLine.tokens, (token) => token.text === 'lang', 'script lang attribute');
  assertTokenIncludesExactScope(scriptLangAttribute, 'entity.other.attribute-name.html', 'script lang attribute');

  const scriptLangValue = findToken(scriptBlockLine.tokens, (token) => token.text.includes('ts'), 'script lang value');
  assertTokenIncludesExactScope(scriptLangValue, 'string.quoted.double.html', 'script lang value');
  assertTokenIncludesExactScope(scriptBlockClose, 'punctuation.definition.tag.end.html', 'script block closing bracket');

  const styleLine = tokenizeLinesWithGrammar(grammar, lines, findLineNumber(lines, '.shell { color: red; }'));
  const colorKeyword = findToken(styleLine.tokens, (token) => token.text === 'red', 'style color keyword');
  assertTokenHasScope(colorKeyword, 'support.constant.color.w3c-standard-color-name.css', 'style color keyword');

  const styleBlockLine = tokenizeLinesWithGrammar(grammar, lines, findLineNumber(lines, '<style>'));
  const styleBlockTag = findToken(styleBlockLine.tokens, (token) => token.text === 'style', 'style block tag');
  assertTokenIncludesExactScope(styleBlockTag, 'entity.name.tag.style.html.tera', 'style block tag');

  const metaBlockLine = tokenizeLinesWithGrammar(grammar, lines, findLineNumber(lines, '<meta>'));
  const metaBlockTag = findToken(metaBlockLine.tokens, (token) => token.text === 'meta', 'meta block tag');
  assertTokenIncludesExactScope(metaBlockTag, 'storage.type.block.tera', 'meta block tag');

  console.log('Grammar regression checks passed.');
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});