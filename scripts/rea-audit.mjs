import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const REA_VERSION = '6.8.0';
const sourceEntries = ['desktop', 'public', 'src', 'server.mjs', 'package.json'];
const focusedRoot = mkdtempSync(join(tmpdir(), 'dawith-welfare-office-rea-'));
const outputDirectory = resolve(ROOT, 'artifacts/rea');

function findResult(stdout) {
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  const resultLine = [...lines].reverse().find((line) => line.startsWith('{"evidence_id"'));
  if (!resultLine) throw new Error('REA did not return a JSON Evidence result.');
  return JSON.parse(resultLine);
}

try {
  for (const entry of sourceEntries) cpSync(resolve(ROOT, entry), join(focusedRoot, entry), { recursive: true });

  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  let stdout;
  try {
    stdout = execFileSync(npx, ['-y', `rea-agents@${REA_VERSION}`, 'analyze-javascript-application', focusedRoot, '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 512 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const stderr = Buffer.isBuffer(error.stderr) ? error.stderr.toString('utf8') : String(error.stderr || '');
    throw new Error(`REA exited with status ${error.status ?? 'unknown'}: ${stderr.trim()}`);
  }

  const evidence = findResult(stdout);
  const normalized = evidence.normalized_result;
  const summary = {
    generatedAt: new Date().toISOString(),
    tool: 'morluto/rea',
    version: REA_VERSION,
    operation: evidence.operation,
    evidenceId: evidence.evidence_id,
    sourceDigest: normalized.root_artifact_sha256,
    sourceFiles: normalized.route_inventory.sources.map((source) => source.path),
    graph: { nodes: normalized.graph.nodes.length, edges: normalized.graph.edges.length },
    routeInventory: normalized.route_inventory.statistics,
    coverage: normalized.route_inventory.coverage,
    limitations: normalized.route_inventory.limitations,
  };

  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(join(outputDirectory, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
} finally {
  rmSync(focusedRoot, { recursive: true, force: true });
}
