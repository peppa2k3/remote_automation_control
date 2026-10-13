import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const composeFile = 'infrastructure/compose/.env';
let compose;
try {
  compose = await readFile(composeFile, 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  compose = (await readFile(`${composeFile}.example`, 'utf8')).replace(
    '<GENERATE_RANDOM_HEX_PASSWORD>',
    randomBytes(24).toString('hex'),
  );
  await writeFile(composeFile, compose, { flag: 'wx' });
}
const password = compose.match(/^POSTGRES_PASSWORD=([a-f0-9]{32,})$/m)?.[1];
if (!password)
  throw new Error(
    'Compose local setup requires a random hex POSTGRES_PASSWORD; existing env was preserved.',
  );
const port = compose.match(/^POSTGRES_DEV_PORT=(\d+)$/m)?.[1] ?? '5432';
const user = compose.match(/^POSTGRES_USER=([a-zA-Z0-9_]+)$/m)?.[1] ?? 'automation';
const database = compose.match(/^POSTGRES_DB=([a-zA-Z0-9_]+)$/m)?.[1] ?? 'automation';
for (const [example, target] of [
  ['backend/.env.example', 'backend/.env'],
  ['frontend/.env.example', 'frontend/.env.local'],
  ['agent-windows/.env.example', 'agent-windows/.env'],
]) {
  let content = await readFile(example, 'utf8');
  if (target === 'backend/.env')
    content = content.replace(
      /^DATABASE_URL=.*$/m,
      `DATABASE_URL=postgresql://${user}:${password}@localhost:${port}/${database}`,
    );
  try {
    await writeFile(target, content, { flag: 'wx' });
    console.log(`Created ${target} (secrets omitted)`);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.log(`Preserved existing ${target}`);
  }
}
console.log('Local configuration ready. Never use these env files for production.');
