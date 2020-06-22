import * as path from 'path';
import RollupCompiler from './RollupCompiler';
import { WebpackCompiler } from './WebpackCompiler';
import { set_dev, set_src, set_dest } from '../../config/env';
import SnowpackCompiler from './SnowpackCompiler';

export type Compiler = RollupCompiler | WebpackCompiler | SnowpackCompiler;

export type Compilers = {
	client: Compiler;
	server: Compiler;
	serviceworker?: Compiler;
}

export default async function create_compilers(
	bundler: 'rollup' | 'webpack' | 'snowpack',
	cwd: string,
	src: string,
	dest: string,
	dev: boolean
): Promise<Compilers> {
	set_dev(dev);
	set_src(src);
	set_dest(dest);

	if (bundler === 'rollup') {
		const config = await RollupCompiler.load_config(cwd);
		validate_config(config, 'rollup');

		normalize_rollup_config(config.client);
		normalize_rollup_config(config.server);

		if (config.serviceworker) {
			normalize_rollup_config(config.serviceworker);
		}

		return {
			client: new RollupCompiler(config.client),
			server: new RollupCompiler(config.server),
			serviceworker: config.serviceworker && new RollupCompiler(config.serviceworker)
		};
	}

	if (bundler === 'webpack') {
		const config = require(path.resolve(cwd, 'webpack.config.js'));
		validate_config(config, 'webpack');

		return {
			client: new WebpackCompiler(config.client),
			server: new WebpackCompiler(config.server),
			serviceworker: config.serviceworker && new WebpackCompiler(config.serviceworker)
		};
	}

	if (bundler === 'snowpack') {
		const client = SnowpackCompiler.config_file('client');
		const server = SnowpackCompiler.config_file('server');
		validate_config({ client, server }, 'snowpack');

		return {
			client: new SnowpackCompiler('client', cwd),
			server: new SnowpackCompiler('server', cwd),
			serviceworker: SnowpackCompiler.config_file('serviceworker') && new SnowpackCompiler('serviceworker', cwd)
		};
	}

	// this shouldn't be possible...
	throw new Error(`Invalid bundler option '${bundler}'`);
}

function validate_config(config: any, bundler: 'rollup' | 'webpack' | 'snowpack') {
	if (!config.client || !config.server) {
		throw new Error(`${bundler} must have a config for client and server.`);
	}
}

export function normalize_rollup_config(config: any) {
	if (typeof config.input === 'string') {
		config.input = path.normalize(config.input);
	} else {
		for (const name in config.input) {
			config.input[name] = path.normalize(config.input[name]);
		}
	}
}
