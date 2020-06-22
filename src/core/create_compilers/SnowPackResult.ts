import colors from 'kleur';

import { CompileResult, CompileError, Chunk, CssFile, BuildInfo } from './interfaces';
import { ManifestData, Dirs } from '../../interfaces';
import extract_css from './extract_css';
import SnowpackCompiler from './SnowpackCompiler';

export default class SnowpackResult implements CompileResult {
  duration: number;
	errors: CompileError[];
	warnings: CompileError[];
	chunks: Chunk[];
	assets: Record<string, string>;
	css_files: CssFile[];
	css: {
		main: string,
		chunks: Record<string, string[]>
  };
  sourcemap: boolean | 'inline';
  summary: string;

  constructor(duration: number, compiler: SnowpackCompiler, sourcemap: boolean | 'inline') {
		// TODO: Determine what is necessary for snowpack
    this.duration = duration;
		this.sourcemap = sourcemap;
		
		this.duration = duration;
		this.sourcemap = sourcemap

		this.errors = compiler.errors.map(munge_warning_or_error);
		this.warnings = compiler.warnings.map(munge_warning_or_error);

		this.chunks = compiler.chunks.map(chunk => ({
			file: chunk.file,
			imports: chunk.imports ? chunk.imports.filter(Boolean): [],
			modules: chunk.deps
		}));

		this.css_files = compiler.css_files;

		this.assets = {};

		if (compiler.type === 'client') {
			this.assets.main = this.chunks[0].file
		}
	}
  
  to_json(manifest_data: ManifestData, dirs: Dirs): BuildInfo {
		// TODO extract_css has side-effects that don't belong
		// in a method called to_json

		return {
			bundler: 'snowpack',
			shimport: require('shimport/package.json').version,
			assets: this.assets,
			css: extract_css(this, manifest_data.components, dirs, this.sourcemap)
		};
  }
  
  print() {
		const blocks: string[] = this.warnings.map(warning => {
			return warning.file
				? `> ${colors.bold(warning.file)}\n${warning.message}`
				: `> ${warning.message}`;
		});

		blocks.push(this.summary);

		return blocks.join('\n\n');
	}
}

function munge_warning_or_error(warning_or_error: any) {
	return {
		file: warning_or_error.filename,
		message: [warning_or_error.message, warning_or_error.frame].filter(Boolean).join('\n')
	};
}