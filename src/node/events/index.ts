// Dependencies
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { glob } from 'glob';
//@ts-ignore require.main.filename support in both ESM and CJS
import filename from 'actual.require.main.filename';
const root = path.dirname(filename);
// Make sure there are no duplicate EventEmitters
const registered: string[] = [];
type Listener = {
	/** Folder names of the event
	 * @example
	 * ```js
	 * ['message', 'create']
	 * ```
	 */
	event: string[];
	/** Path the listener is in
	 * @example
	 * `D:\\myproject\\discord\\functions\\message\\create`
	 */
	path: string;
};
/** Send events to the `functions/` folder in a SplitScript project*/
export class EventEmitter {
	/** folder under `projectroot/functions/` for events to be sent */
	uniqueName: string;
	validEvents: string[];
	/**
	 * Send an event
	 * @example
	 * ```js
	 * const emitter = new EventEmitter('discord');
	 * await emitter.send(['message', 'create'], data);
	 * ```
	 * Sends to `(projectRoot)/functions/discord/message/create` with `data`
	 */
	async send(
		/** Folder names of the event (e.g `['message', 'create']`) */
		event: string[],
		/** event data to send */
		data: object
	) {
		const files = await glob('/*.js', {
			root: path.join(root, 'functions', this.uniqueName, ...event),
		});
		for (let file of files) {
			import(pathToFileURL(file).toString()).then((module) => {
				try {
					// esm implementation
					module.default(data);
				} catch (e) {
					// cjs implementation
					module(data);
				}
			});
		}
	}
	/** Get a list of event listeners
	 * @example
	 * ```js
	 * const listeners = emitter.listeners()
	 * ```
	 */
	async listeners(): Promise<Listener[]>;
	/** Get a list of event listeners with specific event
	 * @example
	 * ```js
	 * const listeners = emitter.listeners(['message', 'create'])
	 * ```
	 */
	async listeners(
		/** specific event to look for (e.g `['message', 'create']` -> look in `projectroot/functions/message/create`) */
		event: string[]
	): Promise<Listener[]>;

	async listeners(event?: string[]) {
		let funcPath = path.join(root, 'functions', this.uniqueName);

		if (fs.existsSync(funcPath)) {
			if (!event) {
				let paths = await glob('/**/*.js', {
					root: funcPath,
				});
				return paths.map((p) => {
					return {
						path: p,
						event: path
							.relative(funcPath, p)
							.split(path.sep)
							.slice(0, -1),
					};
				});
			} else {
				let paths = await glob('/*.js', {
					root: path.join(funcPath, ...event),
				});
				return paths.map((p) => {
					return {
						path: p,
						event: path
							.relative(funcPath, p)
							.split(path.sep)
							.slice(0, -1),
					};
				});
			}
		}
	}

	constructor(
		/** folder under `projectroot/functions/` for events to be sent */
		uniqueName: string,
		/** name of this package (should export Events for intellisense) */
		packageName: string,
		/** possible events (used in the CLI for creating listeners) */
		validEvents: string[]
	) {
		if (registered.includes(uniqueName))
			throw new Error(
				`Cannot have duplicate Event Emitters (${uniqueName})`
			);
		this.uniqueName = uniqueName;
		registered.push(uniqueName);
		fsp.readFile(path.join(root, 'ss.json'), 'utf-8')
			.then((value) => {
				let current = JSON.parse(value);
				current.packages[uniqueName] = {
					validEvents,
					packageName,
				};
				fsp.writeFile(
					path.join(root, 'ss.json'),
					JSON.stringify(current)
				);
			})
			.catch((error) => {
				let current = {
					packages: {
						[uniqueName]: {
							validEvents,
							packageName,
						},
					},
				};
				fsp.writeFile(
					path.join(root, 'ss.json'),
					JSON.stringify(current)
				);
			});
		this.validEvents = validEvents;
	}
}
