import { it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
const root = resolve(import.meta.dirname, '../..');
function files(path: string): string[] { return readdirSync(path).flatMap(name => { const next = resolve(path, name); return statSync(next).isDirectory() ? files(next) : /\.[cm]?[jt]sx?$/.test(name) ? [next] : []; }); }
it('keeps every production import and re-export outside experimental research modules', () => {
  const violations: string[] = [];
  for (const file of [...files(resolve(root, 'src')), ...files(resolve(root, 'worker'))]) {
    const text = readFileSync(file, 'utf8');
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    function visit(node: ts.Node) {
      let specifier: ts.Expression | undefined;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier;
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require')) specifier = node.arguments[0];
      if (specifier && ts.isStringLiteralLike(specifier)) {
        const path = specifier.text;
        const target = path.startsWith('.') ? resolve(dirname(file), path) : path;
        if (/[/\\]research[/\\]|universal-remediated|universal-synergy/.test(target)) violations.push(`${file}: ${path}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  expect(violations).toEqual([]);
});
it('keeps the dormant manifest disabled and pins the reviewed module bytes', async () => {
  const { createHash } = await import('node:crypto');
  const manifest = JSON.parse(readFileSync(resolve(root, 'research/universal-remediated/manifest.json'), 'utf8')) as { active: boolean; productionScoringIntegration: boolean; hashes: Record<string,string> };
  expect(manifest.active).toBe(false); expect(manifest.productionScoringIntegration).toBe(false);
  for (const [path, digest] of Object.entries(manifest.hashes)) expect(createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex')).toBe(digest);
});
