#!/usr/bin/env node
const { Command } = require('commander')
const { AutoComplete, MultiSelect, Confirm } = require('enquirer')

import c from 'ansi-colors'
import fs from 'fs'
import fsp from 'fs/promises'
import { glob } from 'glob'
import path from 'path'
import { build } from './build'
import { watchFunctions, watchProject } from './dev'
import {
	createFoldersRecursive,
	deleteDirectoryRecursive,
	getExistingEvents,
	getPackageName,
	getSplitscriptConfig,
	getType,
	getValidEvents,
	isTs
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
				p.endsWith('.ts') ? path.basename(p, '.ts') : path.basename(p, '.js')
			)
			.map(Number)
			.filter((fname) => !isNaN(fname))
		const incremented = Math.max(...(numbers.length === 0 ? [0] : numbers)) + 1
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
				fsp
					.unlink(path.join(root, 'functions', pckg, ...ans.split('/'), file))
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
		if (file) {
			const exists = fs.existsSync(file)
			if (!exists) return console.log(c.bold.red(`File ${file} does not exist`))
			const stat = await fsp.lstat(file)
			if (stat.isDirectory()) {
				const ss = await getSplitscriptConfig()
				const ts = await isTs(path.join(root, file))
				const main = ss.main ?? (ts ? 'index.ts' : 'index.js')

				if (!fs.existsSync(path.join(file, main)))
					return console.error(c.bgRed(' ERROR '), `Could not find ${main}`)

				watchProject(path.join(root, file), main)
				watchFunctions(path.join(root, file))
			} else if (stat.isFile()) {
				if (!fs.existsSync(file))
					return console.error(
						c.bgRed(' ERROR '),
						`Could not find ${path.basename(file)}`
					)
				watchProject(path.join(root, path.dirname(file)), path.basename(file))
				watchFunctions(root)
			}
		} else {
			watchFunctions(root)
		}
	})

program
	.command('build')
	.description(c.italic('Build a project for production'))
	.argument('<folder>', 'Name of folder to build')
	.action(async (folder) => {
		if (!fs.existsSync(folder))
			return console.error(
				c.bgRed(' ERROR '),
				`Could not find ${path.basename(folder)}`
			)
		const stat = await fsp.lstat(folder)
		if (!stat.isDirectory())
			return console.log(c.bgRed(' ERROR '), `Path must be a folder`)
		const buildDir = (await getSplitscriptConfig(folder)).build ?? 'build'
		const files = await glob('/**/*.{ts,js}', {
			root: path.join(root, folder),
			ignore: [`**/${buildDir}/**`, '**/node_modules/**']
		})
		deleteDirectoryRecursive(path.join(root, folder, buildDir))
		const buildPromises = files.map((file) =>
			build(file, folder, buildDir).catch((e) => {
				console.error(
					c.bgRed(' ERROR '),
					`Failed to build ${c.bold.red(file)}\n`,
					e
				)
			})
		)
		await Promise.all(buildPromises)
	})

program.parse()
