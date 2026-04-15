const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const reportOnly = process.argv.includes("--report");

const errors = [];
const warnings = [];

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function hasLicenseFile() {
  return ["LICENSE", "LICENSE.md", "LICENSE.txt"].some(exists);
}

if (!pkg.publisher || pkg.publisher === "terajs-local") {
  errors.push("Replace the placeholder publisher 'terajs-local' with a real Visual Studio Marketplace publisher id.");
}

if (!pkg.repository || (typeof pkg.repository !== "string" && typeof pkg.repository.url !== "string")) {
  errors.push("Add a repository URL to package.json.");
}

if (!hasLicenseFile()) {
  errors.push("Add a root license file before publishing so VSCE does not need --skip-license.");
}

if (!exists("README.md")) {
  errors.push("README.md is required for marketplace publication.");
}

if (!exists("CHANGELOG.md")) {
  errors.push("CHANGELOG.md is missing.");
}

if (!pkg.description || String(pkg.description).trim().length < 20) {
  warnings.push("Add a slightly richer package description before publishing.");
}

if (!pkg.icon) {
  warnings.push("Consider adding an icon field and icon asset before publishing.");
}

if (pkg.version === "0.0.1") {
  warnings.push("Choose the first public release version intentionally before publishing.");
}

const lines = [];

lines.push("Terajs .tera Tools publish status");
lines.push("");

if (errors.length === 0) {
  lines.push("Required checks: ready");
} else {
  lines.push("Required checks:");
  for (const error of errors) {
    lines.push(`- ${error}`);
  }
}

if (warnings.length > 0) {
  lines.push("");
  lines.push("Recommended improvements:");
  for (const warning of warnings) {
    lines.push(`- ${warning}`);
  }
}

console.log(lines.join("\n"));

if (!reportOnly && errors.length > 0) {
  process.exit(1);
}