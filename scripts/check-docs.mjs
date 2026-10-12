import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

assert.deepEqual(
  await readFile('PROJECT_CONTEXT.md'),
  await readFile('docs/PROJECT_CONTEXT.md'),
  'Context copies differ',
);
const prompts = new Map();
for (const folder of ['promt', 'processing', 'completed']) {
  for (const file of await readdir(`docs/${folder}`)) {
    if (!file.endsWith('.md')) continue;
    const body = await readFile(`docs/${folder}/${file}`, 'utf8');
    const id = body.match(/^id: "(\d{3})"$/m)?.[1];
    const status = body.match(/^status: (\w+)$/m)?.[1];
    const deps = JSON.parse(body.match(/^depends_on: (\[[^\n]*\])$/m)?.[1] ?? '[]');
    assert.ok(id && file.startsWith(`${id}-`), `Invalid ID: ${file}`);
    assert.ok(!prompts.has(id), `Duplicate prompt: ${id}`);
    const allowed =
      folder === 'promt'
        ? ['PLANNED']
        : folder === 'completed'
          ? ['DONE']
          : ['IN_PROGRESS', 'PARTIAL', 'BLOCKED'];
    assert.ok(allowed.includes(status), `Wrong status for ${folder}/${file}`);
    if (folder === 'completed')
      assert.ok(!body.includes('- [ ]'), `Incomplete acceptance: ${file}`);
    prompts.set(id, { deps, folder });
  }
}
for (const [id, prompt] of prompts) {
  for (const dep of prompt.deps) {
    assert.ok(prompts.has(dep) && dep !== id, `Invalid dependency ${id} -> ${dep}`);
    if (prompt.folder !== 'promt')
      assert.equal(prompts.get(dep).folder, 'completed', `Dependency not completed: ${dep}`);
  }
}
function visit(id, active = new Set(), done = new Set()) {
  assert.ok(!active.has(id), `Dependency cycle: ${id}`);
  if (done.has(id)) return;
  active.add(id);
  for (const dep of prompts.get(id).deps) visit(dep, active, done);
  active.delete(id);
  done.add(id);
}
for (const id of prompts.keys()) visit(id);
console.log(
  `Docs check passed: context synchronized, ${prompts.size} unique prompts, valid lifecycle and dependencies.`,
);
