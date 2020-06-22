import fs from 'fs';
import path from 'path';
import { build_dir, dev } from '@sapper/internal/manifest-server';

const get_build_info = dev
		? () => JSON.parse(fs.readFileSync(path.join(build_dir, 'build.json'), 'utf-8'))
    : (assets => () => assets)(JSON.parse(fs.readFileSync(path.join(build_dir, 'build.json'), 'utf-8')));
    
const build_info: {
  bundler: 'rollup' | 'webpack' | 'snowpack',
  shimport: string | null,
  assets: Record<string, string | string[]>,
  legacy_assets?: Record<string, string>
  } = get_build_info();

export default build_info