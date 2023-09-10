// Dependencies
import fs from 'fs'
import fsp from 'fs/promises'
import { glob } from 'glob'
import path from 'path'
import { pathToFileURL } from 'url'

import ansiColors from 'ansi-colors'
import { root } from '../index.js'

// Make sure there are no duplicate EventEmitters
const registered: string[] = []
type Listener = {
	/** Folder names of the event
	 * @example
	 * ```js
	 * ['message', 'create']
	 * ```
	 */
	event: string[]
	/** Path the listener is in
	 * @example
	 * `D:\\myproject\\discord\\functions\\message\\create`
	 */
	path: string
}
type Split<S extends string, D extends string> = string extends S
	? string[]
	: S extends ''
	? []
	: S extends `${infer T}${D}${infer U}`
	? [T, ...Split<U, D>]
	: [S]

export class EventEmitter<Events extends readonly string[]> {
	/** folder under `projectroot/functions/` for events to be sent */
	uniqueName: string
	validEvents: string[]
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
		event: Split<Events[number], '/'>,
		/** event data to send */
		data: object
	) {
		const files = await glob('/*.js', {
			root: path.join(root(), 'functions', this.uniqueName, ...event)
		})
		for (let file of files) {
			const url = pathToFileURL(file)
			import(url.toString())
				.then((module) => {
					try {
						// esm implementation
						module.default(data)
					} catch (e) {
						if (typeof module !== 'function')
							return console.log(
								ansiColors.bgRed(' ERROR '),
								`Listener ${path.basename(
									file
								)} does not export a function (export default for esm, module.exports = for cjs)`
							)
						// cjs implementation
						module(data)
					}
				})
				.catch(() => console.log(`failed to run function`))
		}
	}
	/** Get a list of event listeners
	 * @example
	 * ```js
	 * const listeners = emitter.listeners()
	 * ```
	 */
	async listeners(): Promise<Listener[]>
	/** Get a list of event listeners with specific event
	 * @example
	 * ```js
	 * const listeners = emitter.listeners(['message', 'create'])
	 * ```
	 */
	async listeners(
		/** specific event to look for (e.g `['message', 'create']` -> look in `projectroot/functions/message/create`) */
		event: Split<Events[number], '/'>
	): Promise<Listener[]>

	async listeners(event?: string[]) {
		let funcPath = path.join(root(), 'functions', this.uniqueName)

		if (fs.existsSync(funcPath)) {
			if (!event) {
				let paths = await glob('/**/*.js', {
					root: funcPath
				})
				return paths.map((p) => {
					return {
						path: p,
						event: path.relative(funcPath, p).split(path.sep).slice(0, -1)
					}
				})
			} else {
				let paths = await glob('/*.js', {
					root: path.join(funcPath, ...event)
				})
				return paths.map((p) => {
					return {
						path: p,
						event: path.relative(funcPath, p).split(path.sep).slice(0, -1)
					}
				})
			}
		}
	}

	/** Creates an Event Emitter
	 *
	 * @example
	 * ```ts
	 * const emitter = new EventEmitter('discord', '@splitscript.js/discord', [
	 * 	'message/create',
	 * 	'message/delete'
	 * ] as const)
	 * ```
	 */
	constructor(
		/** folder under `projectroot/functions/` for events to be sent */
		uniqueName: string,
		/** name of this package (should export Events for intellisense) */
		packageName: string,
		/** possible events (used in the CLI for creating listeners) */
		validEvents: Events
	) {
		if (registered.includes(uniqueName))
			throw new Error(`Cannot have duplicate Event Emitters (${uniqueName})`)
		this.uniqueName = uniqueName
		registered.push(uniqueName)
		console.log(process.env.CONFIG_LOCATION ?? root())
		fsp
			.readFile(
				path.join(process.env.CONFIG_LOCATION ?? root(), 'ss.json'),
				'utf-8'
			)
			.then((value) => {
				let current = JSON.parse(value)
				current.packages[uniqueName] = {
					validEvents,
					packageName
				}
				fsp.writeFile(
					path.join(process.env.CONFIG_LOCATION ?? root(), 'ss.json'),
					JSON.stringify(current)
				)
			})
			.catch((err) => {
				console.log(err)
				let current = {
					packages: {
						[uniqueName]: {
							validEvents,
							packageName
						}
					}
				}
				fsp.writeFile(
					path.join(process.env.CONFIG_LOCATION ?? root(), 'ss.json'),
					JSON.stringify(current)
				)
			})
		this.validEvents = Array.from(validEvents)
	}
}
