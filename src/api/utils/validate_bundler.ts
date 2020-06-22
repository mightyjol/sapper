import * as fs from 'fs';

export default function validate_bundler(bundler?: 'rollup' | 'webpack' | 'snowpack', ignore?: ('rollup' | 'webpack' | 'snowpack')[]) {
	if (!bundler) {
		bundler = (
			(!ignore || !~ignore.indexOf('snowpack')) && fs.existsSync('snowpack.config.js') || fs.existsSync('snowpack.config.json') ? 'snowpack' :
			(!ignore || !~ignore.indexOf('rollup')) && fs.existsSync('rollup.config.js') || fs.existsSync('rollup.config.ts') ? 'rollup' :
			(!ignore || !~ignore.indexOf('webpack')) && fs.existsSync('webpack.config.js') || fs.existsSync('webpack.config.ts') ? 'webpack' : null
		);

		if (!bundler) {
			// TODO remove in a future version
			deprecate_dir('rollup');
			deprecate_dir('webpack');
			deprecate_dir('snowpack');

			throw new Error(`Could not find a configuration file for rollup, webpack or snowpack`);
		}
	}

	if (bundler !== 'rollup' && bundler !== 'webpack' && bundler !== 'snowpack') {
		throw new Error(`'${bundler}' is not a valid option for --bundler — must be either 'rollup', 'webpack' or 'snowpack'`);
	}

	return bundler;
}

function deprecate_dir(bundler: 'rollup' | 'webpack' | 'snowpack') {
	try {
		const stats = fs.statSync(bundler);
		if (!stats.isDirectory()) return;
	} catch (err) {
		// do nothing
		return;
	}

	// TODO link to docs, once those docs exist
	throw new Error(`As of Sapper 0.21, build configuration should be placed in a single ${bundler}.config.js file`);
}
