#!/usr/bin/env node
const { Command } = require('commander')
const { AutoComplete, MultiSelect, Confirm } = require('enquirer')

import fsp from 'fs/promises'
import fs from 'fs'
import chokidar from 'chokidar'
import path from 'path'
import { glob } from 'glob'
import c from 'ansi-colors'
import { spawn } from 'child_process'
import {
	createFoldersRecursive,
	getPackageName,
	getType,
	getValidEvents,
	isTs,
	getCurrentFunctionPackage,
	getEventName,
	getExistingEvents
} from './utils'

const root = process.cwd()
const program = new Command()

program
	.name('splitscript')
	.description(c.green('CLI for SplitScript.js'))
	.version('1.0.0')

program
	.command('add')
	.description(c.italic('Add an event listener'))
	.argument('<package>', 'Package Name')
	.action(async (pckg) => {
		const valid = await getValidEvents(pckg)
		if (valid.length === 0) {
			console.log(c.red('No valid events found'))
			process.exit(1)
		}
		const autocomplete = new AutoComplete({
			name: 'event',
			message: 'Select an event to create',
			choices: valid
		})
		const ans = await autocomplete.run().catch(handleReject)
		const event = ans
			.trim()
			.toLowerCase()
			.split(/[\/\\_]/)
		const funcPath = path.join(root, 'functions', pckg, ...event)
		const existing = await glob('/*.{ts,js}', { root: funcPath })
		const numbers = existing
			.map((p) =>
				p.endsWith('.ts')
					? path.basename(p, '.ts')
					: path.basename(p, '.js')
			)
			.map(Number)
			.filter((fname) => !isNaN(fname))
		const incremented =
			Math.max(...(numbers.length === 0 ? [0] : numbers)) + 1
		await createFoldersRecursive(funcPath)
		const type = await getType()
		const packageName = await getPackageName(pckg)
		const eventName = event
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join('')
		const typescript = await isTs()

		const code = typescript
			? `import { Events } from '${packageName}';\nexport default async function (event: Events.${eventName}) {\n\n}`
			: type === 'module'
			? `/** @typedef {import('${packageName}').Events.${eventName}} Event */\n/** @param {Event} event */\n\nexport default async function (event) {\n\n}`
			: `/** @typedef {import('${packageName}').Events.${eventName}} Event */\n/** @param {Event} event */\n\nmodule.exports = async function (event) {\n\n}`

		const filename = path.join(
			funcPath,
			`${incremented}.${typescript ? 'ts' : 'js'}`
		)
		await fsp.writeFile(filename, code)
		console.log(
			`Created ${c.blue(path.relative(root, filename))} ${
				typescript
					? c.gray('(Using Typescript)')
					: type === 'module'
					? c.gray('(Using ESModules)')
					: c.gray('(Using CommonJS)')
			}`
		)
	})

async function handleReject() {
	console.log(c.red('Exited'))
	process.exit(1)
}
program
	.command('remove')
	.description(c.italic('Remove an event listener'))
	.argument('<package>', 'Package Name')
	.action(async (pckg) => {
		const events = await getExistingEvents(pckg)
		if (events.length === 0) {
			console.error(c.red('No event listeners exist'))
			process.exit(1)
		}
		const autocomplete = new AutoComplete({
			name: 'event',
			message: 'Select an event to remove',
			choices: events
		})
		const ans = await autocomplete.run().catch(handleReject)
		const files = await glob('/*.{ts,js}', {
			root: path.join(root, 'functions', pckg, ...ans.split('/'))
		})
		const toDelete = await new MultiSelect({
			name: 'files',
			message: 'What files to delete?',
			choices: files.map((file) => path.basename(file))
		})
			.run()
			.catch(handleReject)
		const cont = await new Confirm({
			name: 'confirmDelete',
			message: 'Are you sure you want to delete these files?'
		})
			.run()
			.catch(handleReject)
		if (cont) {
			toDelete.forEach((file) => {
				fsp.unlink(
					path.join(root, 'functions', pckg, ...ans.split('/'), file)
				)
					.then(() => console.log(c.green(`Deleted ${file}`)))
					.catch(() => console.log(c.red(`Failed to delete ${file}`)))
			})
		} else console.log(c.red('Cancelled'))
	})

program
	.command('dev')
	.description(c.italic('Developer mode'))
	.argument('[file]', 'Name of file to run')
	.action(async (file) => {
		const type = await getType()
		console.log(
			`${c.green('Now in dev mode')} ${c.gray(
				`(Using ${type === 'commonjs' ? 'CommonJS' : 'ESModules'})`
			)}`
		)

		async function start() {
			if (file) {
				let filepath = path.resolve(root, file)
				if (!fs.existsSync(filepath)) {
					console.log(c.red(`File ${file} not found`))
					process.exit(1)
				}
				if (file.endsWith('.ts')) {
					console.log(c.red('Cannot run TypeScript files (yet)'))
					return
				}
				/*
				await new Promise(async (resolve) => {
					if (file.endsWith('.ts')) {
						
						console.log(c.yellow('Building...'));
						const tsc = spawn(
							'tsc',
							[file, '--outdir .ss-devbuild'],
							{
								env: process.env,
								shell: true,
							}
						);

						tsc.stdout.on('data', (data) => {
							console.log(`stdout: ${data}`);
						});

						tsc.stderr.on('data', (data) => {
							console.error(`stderr: ${data}`);
						});

						tsc.on('close', (code) => {
							console.log(c.yellow('Built!'));
							filepath = join(
								dirname(filepath),
								'.ss-devbuild',
								basename(filepath, '.ts') + '.js'
							);
							resolve(null);
						});
						
					} else resolve(null);
				});
				*/
				function run() {
					const child = spawn('node', [filepath])
					console.log(`Started ${c.green(file)}`)
					child.stdout?.on('data', (data) => {
						const now = new Date()
						const formattedDate = `${
							now.getMonth() + 1
						}/${now.getDate()}/${now
							.getFullYear()
							.toString()
							.substr(-2)} ${now.getHours()}:${now
							.getMinutes()
							.toString()
							.padStart(2, '0')}`
						process.stdout.write(
							`${c.green(formattedDate)} ${data}`
						)
					})
					child.stderr?.on('data', (data) => {
						const now = new Date()
						const formattedDate = `${
							now.getMonth() + 1
						}/${now.getDate()}/${now
							.getFullYear()
							.toString()
							.substr(-2)} ${now.getHours()}:${now
							.getMinutes()
							.toString()
							.padStart(2, '0')}`
						process.stderr.write(`${c.red(formattedDate)} ${data}`)
					})
					child.on('close', () => {
						run()
					})
				}
				run()
			}
		}
		start()
		const watcher = chokidar.watch(path.join(root, 'functions'), {
			ignoreInitial: true
		})

		watcher.on('add', async (filepath: string) => {
			const currentFunctionPackage = getCurrentFunctionPackage(filepath)
			const packageName = await getPackageName(currentFunctionPackage)
			const eventName = getEventName(filepath, currentFunctionPackage)
			console.log(`Added ${c.blue(path.basename(filepath))}`)

			if (filepath.endsWith('.js')) {
				const code =
					type === 'module'
						? `/** @typedef {import('${packageName}').Events.${eventName}} Event */\n/** @param {Event} event */\n\nexport default async function (event) {\n\n}`
						: `/** @typedef {import('${packageName}').Events.${eventName}} Event */\n/** @param {Event} event */\n\nmodule.exports = async function (event) {\n\n}`
				fsp.writeFile(filepath, code).catch(() =>
					c.red('Error: Failed to update file')
				)
			} else if (filepath.endsWith('.ts')) {
				fsp.writeFile(
					filepath,
					`import { Events } from '${packageName}';\nexport default async function (event: Events.${eventName}) {\n\n}`
				).catch(() => c.red('Error: Failed to update file'))
			}
		})
	})
program.parse()
