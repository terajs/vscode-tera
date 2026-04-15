const fs = require('node:fs');
const {
  tokenizeLinesWithGrammar,
  loadTeraGrammar
} = require('./vscodeGrammarRegistry.cjs');

async function main() {
  const grammarPath = process.argv[2];
  const samplePath = process.argv[3];
  const sampleLineNumber = Number(process.argv[4] || '1');

  const lines = fs.readFileSync(samplePath, 'utf8').split(/\r?\n/);
  const grammar = await loadTeraGrammar(grammarPath);
  const result = tokenizeLinesWithGrammar(grammar, lines, sampleLineNumber);

  console.log(JSON.stringify({
    lineNumber: result.lineNumber,
    line: result.line,
    tokens: result.tokens
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
