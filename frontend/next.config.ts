import type { NextConfig } from 'next';
import path from 'node:path';

const config: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(process.cwd(), '..'),
  poweredByHeader: false,
  turbopack: { root: path.join(process.cwd(), '..') },
};
export default config;
