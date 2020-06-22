import * as fs from 'fs';
import * as path from 'path';
import { mkdirp } from './fs_utils';

const runtime = [
	'app.mjs',
	'server.mjs',
	'internal/shared.mjs',
	'internal/layout.svelte',
	'internal/error.svelte'
].map(file => ({
	file,
	source: fs.readFileSync(path.join(__dirname, `../runtime/${file}`), 'utf-8')
}));

export function copy_runtime(output: string, bundler: 'rollup' | 'webpack' | 'snowpack') {
	runtime.forEach(({ file, source }) => {
		if (bundler === 'snowpack') {
			file = file.replace('.mjs', '.js')
		}
		mkdirp(path.dirname(`${output}/${file}`));
		fs.writeFileSync(`${output}/${file}`, source);
	});
}