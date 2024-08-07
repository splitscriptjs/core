// Dependencies
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { glob } from 'glob'
import ansiColors from 'ansi-colors'

import { root } from '../index.js'

/** **Internal** - Used to check for duplicate event listeners */
const registered: string[] = []
/** **Internal** - Type returned when getting all listeners */
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

/** Used to send events */
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
		const files = await glob(
			`/functions/${this.uniqueName}/${event.join('/')}/*.js`,
			{
				root: root()
			}
		)
		for (const file of files) {
			const url = pathToFileURL(file)
			import(url.toString()).then((module) => {
				if (typeof module.default === 'function') {
					module.default(data)
				} else if (typeof module === 'function') {
					module(data)
				} else {
					return console.log(
						ansiColors.bgRed(' ERROR '),
						`Listener ${path.basename(
							file
						)} does not export a function (export default for esm, module.exports = for cjs)`
					)
				}
			})
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
				const paths = await glob('/**/*.js', {
					root: funcPath
				})
				return paths.map((p) => {
					return {
						path: p,
						event: path.relative(funcPath, p).split(path.sep).slice(0, -1)
					}
				})
			} else {
				const paths = await glob(
					`/functions/${this.uniqueName}/${event.join('/')}/*.js`,
					{
						root: root()
					}
				)
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
		let fname = path.join(process.env.CONFIG_LOCATION ?? root(), ".ss.json")
		let exists = fs.existsSync(fname)
		if (!exists) {
			fs.writeFileSync(fname, "{}")
		}

		fsp
			.readFile(
				fname,
				'utf-8'
			)
			.then((value) => {
				let current = JSON.parse(value)
				current[uniqueName] = {
					validEvents,
					packageName
				}
				fsp.writeFile(
					fname,
					JSON.stringify(current, null, '\t')
				)
			}, (err) => {
				throw "Failed to write to json " + err
			})
			.catch((err) => {
				throw "Failed to write to json " + err
			})
		this.validEvents = Array.from(validEvents)
	}
}
