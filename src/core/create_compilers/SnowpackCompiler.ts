import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import relative from 'require-relative';
import * as WebSocket from 'ws';

import { CompileResult, Chunk } from './interfaces';
import SnowpackResult from './SnowPackResult';

import { HotModuleState } from '../SnowpackHmr';
import * as __SNOWPACK_HMR__ from '../SnowpackHmr';
import RollupCompiler from './RollupCompiler';
import { WebpackCompiler } from './WebpackCompiler';
import validate_bundler from '../../api/utils/validate_bundler';
import { cache } from '../../core';

import { normalize_rollup_config } from '.';

type Type = 'client' | 'server' | 'serviceworker';

const configExts: [ 'js', 'json', 'cjs' ] = [ 'js', 'json', 'cjs' ];

let ws: WebSocket;
let client: WebSocket;
let eventBus = new EventEmitter();

export default class SnowpackCompiler {
	private _type: Type;
	private _cwd: string;
	private _oninvalid: (filename: string) => void;
	private _onwatch: (err?: Error, stats?: any) => void;
	private _clientTimeout: NodeJS.Timer;
	// private _commandOptions: CommandOptions;

	private _bundler: WebpackCompiler | RollupCompiler;

	warnings: any[];
	errors: any[];
	chunks: any[];
	css_files: Array<{ id: string, code: string }>;

  constructor (type: Type, cwd: string) {
		this._type = type;
		this._cwd = cwd;

		this.warnings = [];
		this.errors = [];
		this.chunks = [];
		this.css_files = [];
	}

	private async _create_build_compiler (): Promise<WebpackCompiler | RollupCompiler> {
		if (!this._bundler) {
			// TODO: maybe bundler creation should be abstracted and used coherent in 'create_compilers' and 'SnowpackCompiler'
			const bundler = validate_bundler(null, ['snowpack']);

			if (bundler === 'rollup') {
				const config = await RollupCompiler.load_config(this._cwd);
				normalize_rollup_config(config);

				this._bundler = new RollupCompiler(config[this._type]);
			}

			if (bundler === 'webpack') {
				const config = require(path.resolve(this._cwd, 'webpack.config.js'));
				this._bundler = new WebpackCompiler(config[this._type]);
			}
		}

		if (!this._bundler) {
			throw new Error('Could not create bundler for snowpack compiler.');
		}

		this._bundler.oninvalid(this._oninvalid);
		return this._bundler;
	}

	private _reconnect_to_build_tool () {
		clearTimeout(this._clientTimeout);
		this._clientTimeout = setTimeout(() => this._connect_to_build_tool(), 3000);
	}

	private _connect_to_build_tool () {
		// Act like snowpack '/__snowpack__/hmr.js'
		if (!ws) ws = relative('ws', this._cwd);
		if (!client || client.readyState !== ws.OPEN) {
			const socketURL = process.env.HMR_SOCKET_URL || 'ws://localhost:8080/';
			client?.close();
			client = __SNOWPACK_HMR__.client(ws, socketURL);

			client.addEventListener('close', () => {
				console.log(`[SnowpackCompiler] connection closed to ${socketURL}. Reconnect...`);
				this._reconnect_to_build_tool();
			});

			client.addEventListener('error', (error: any) => {
				// TODO: Verify if additional error handling is necessary
				// console.log(`[SnowpackCompiler] error while connected to ${socketURL}. Reconnect...`);
				// this._reconnect_to_build_tool()
			});
		}

		// Act like snowpack '/_dist_/index.js'
		const meta: {
			url: string
			hot?: HotModuleState
			env: {
				MODE: string,
				NODE_ENV: string
			}
		} = { 
			url: `http://localhost:8080/client/${this.chunks[0].file}`,
			env: {
				MODE: 'development',
				NODE_ENV: 'development'
			}
		}

		meta.hot = __SNOWPACK_HMR__.createHotContext(meta.url);

		if (meta.hot) {
			meta.hot.accept(null, ({ module, deps }) => {
				console.log('Accepted:', module, deps);

				const file = module.replace('/client/', '');
				// this.chunks = [{ file, deps }] // this does not work. client/client.js?mtime=123456 will be undefined in sapper context

				this._oninvalid(`${this._cwd}/src/${file}`);
				this._onwatch(null, new SnowpackResult(0, this, false));
				eventBus.emit('watch');
			});
			meta.hot.dispose(() => {
				console.log('Dispose');
			});
		}
	}
	
	oninvalid(cb: (filename: string) => void) {
		if (this._bundler) this._bundler.oninvalid(cb);
		this._oninvalid = cb;
	}

  async compile (): Promise<CompileResult> {
		const compiler = await this._create_build_compiler();
		return compiler.compile();
  }

  async watch (cb: (err?: Error, stats?: any) => void) {
		this._onwatch = cb;

		const start = Date.now();
		this.chunks = [{ file: 'client.js', deps: [] }];

		/** TODO: skip service worker build as soon as { type: module" } is supported
		/* @see https://bugs.chromium.org/p/chromium/issues/detail?id=824647
		**/
		if (this._type === 'serviceworker') {
			const compiler = await this._create_build_compiler();
			return compiler.watch(cb);
		}

		if (this._type !== 'client') {
			// Do not build anything in watch mode because: snowpack
			// eventBus is a workaround to trigger non client watch without actual build
			// TODO: Maybe sapper should be able to handle compiler without an actual build in dev environment
			eventBus.on('watch', () => {
				cb(null, new SnowpackResult(0, this, false));
			})

			cb(null, new SnowpackResult(Date.now() - start, this, false));
			return;
		}

		this._connect_to_build_tool();

		cb(null, new SnowpackResult(Date.now() - start, this, false));
  }

  static config_file (type: Type): string | undefined {
    const config = `snowpack.${type === 'client' ? 'config' : type}`;

    for (const ext of configExts) {
			const file = `${ config }.${ ext }`;
      if (fs.existsSync(file)) {
        return file;
      }
    }
	}

	static service_worker () {
		cache
	}

	get type () { return this._type }
}

export function handleError(err: Error, recover = false) {
	// TODO: Error output
	if (!recover) process.exit(1);
}