import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const get = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('renamed Foundry module identity and entry points are consistent', () => {
  const manifest = JSON.parse(get('module.json'));
  assert.equal(manifest.id, 'wod20-initiative-tool');
  assert.equal(manifest.title, 'WoD20 Initiative Tool (Beta)');
  assert.equal(manifest.version, '0.1.3');
  assert.deepEqual(manifest.esmodules, ['scripts/main.mjs']);
  assert.deepEqual(manifest.styles, ['styles/initiative-tool.css']);
  assert.equal(manifest.socket, true);
  assert.match(manifest.download, /v0\.1\.3\/wod20-initiative-tool-v0\.1\.3-beta\.zip$/);
  assert.match(manifest.manifest, /v0\.1\.3\/module\.json$/);
  assert.match(get('scripts/main.mjs'), /const ID = "wod20-initiative-tool"/);
  assert.match(get('scripts/main.mjs'), /getFlag\(ID, "locked"\)/);
  assert.match(get('scripts/top-turn-controls.mjs'), /wod20-initiative-tool-turn-navigation/);
  assert.match(get('styles/initiative-tool.css'), /\.wod20-initiative-tool-toolbar/);
  assert.match(get('README.md'), /Data\/modules\/wod20-initiative-tool/);
  const runtimeFiles = ['scripts/main.mjs', 'scripts/order.mjs', 'scripts/top-turn-controls.mjs', 'scripts/delay.mjs', 'scripts/health.mjs', 'styles/initiative-tool.css'];
  for (const path of runtimeFiles) assert.doesNotMatch(get(path), /stl-initiative-guard|stlInitiativeGuard|\bInitiative Guard\b/, `${path} has an obsolete runtime identifier`);
});
