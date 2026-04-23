const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const distRoot = path.join(root, 'dist');

const { findFieldDefinition, getBlockDefinition } = require(path.join(distRoot, 'teraSchema.js'));

test('ai schema includes entities as a list-capable field', () => {
  const aiBlock = getBlockDefinition('ai');
  const entitiesField = findFieldDefinition(aiBlock.fields, 'entities');

  assert.ok(entitiesField, 'Expected the ai block schema to define an entities field.');
  assert.equal(entitiesField.kind, 'string-or-list');
  assert.equal(entitiesField.useListSnippet, true);
});

test('meta and ai schemas allow unknown top-level keys', () => {
  const metaBlock = getBlockDefinition('meta');
  const aiBlock = getBlockDefinition('ai');

  assert.equal(metaBlock.allowUnknownTopLevel, true);
  assert.equal(aiBlock.allowUnknownTopLevel, true);
});