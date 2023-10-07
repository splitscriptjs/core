import c from 'ansi-colors'
import chokidar from 'chokidar'
import { existsSync } from 'fs'
import fsp from 'fs/promises'
import { glob } from 'glob'
import path from 'path'
import boilerplate from './boilerplate'
import { build } from './build'
import { run } from './run'
import {
	deleteDirectoryRecursive,
	getEventFolder,
	getEventName,
	getSplitscriptConfig,
	getType,
	validEventFolder
} from './utils'

function globMatch(pattern: string[], items: string[]): boolean {
	const beforeDoubleStar = pattern.slice(0, pattern.indexOf('**'))
	const itemsBeforeDoubleStar = items.slice(0, beforeDoubleStar.length)
	if (
		pattern.at(-1) === '**' &&
		JSON.stringify(beforeDoubleStar) === JSON.stringify(itemsBeforeDoubleStar)
	)
		return true
	let patternIndex = 0
	let itemIndex = 0

	while (patternIndex < pattern.length && itemIndex < items.length) {
		const currentPattern = pattern[patternIndex]
		const currentItem = items[itemIndex]

		if (currentPattern === '**') {
			// Handle '**': allow any number of items
			patternIndex++
			while (
				itemIndex < items.length &&
				currentItem !== pattern[patternIndex]
			) {
				itemIndex++
			}
			patternIndex++
		} else if (currentPattern === '*') {
			// Handle '*': allow one item
			patternIndex++
			itemIndex++
		} else {
			// Compare other items
			if (currentPattern !== currentItem) {
				return false
			}
			patternIndex++
			itemIndex++
		}
	}

	// Check if we reached the end of both arrays
	return patternIndex === pattern.length && itemIndex === items.length
}

export async function watchFunctions(root: string) {
	const watcher = chokidar.watch(path.join(root, 'functions'), {
		ignoreInitial: true
	})

	watcher.on('add', async (filePath: string, stats) => {
		const p = path.parse(filePath)
		if (stats?.size !== 0) return
		const type = await getType(root)
		const ss = await getSplitscriptConfig(root)
		if (!ss.packages) {
			console.log(c.bgRed(` ERROR `), `Invalid ss.json`)
			process.exit(1)
		}

		const eventFolder = getEventFolder(filePath)
		if (!validEventFolder(ss, eventFolder)) return

		const eventName = getEventName(filePath, eventFolder, root)
		const packageName = ss.packages[eventFolder]?.packageName
		if (!packageName)
			return console.log(
				c.bgRed(` ERROR `),
				`Could not get package name for ${c.red(eventFolder)}`
			)
		const validEvents = ss.packages[eventFolder]?.validEvents
		if (!validEvents) {
			console.log(c.bgRed(` ERROR `), `Failed to get valid events`)
			process.exit(1)
		}
		if (!Array.isArray(validEvents)) {
			console.log(c.bgRed(` ERROR `), `Malformed validEvents in ss.json`)
			process.exit(1)
		}
		if (!(validEvents as any[]).every((v) => typeof v === 'string')) {
			console.log(c.bgRed(` ERROR `), `Malformed validEvents in ss.json`)
			process.exit(1)
		}
		const split: string[][] = validEvents.map((v) => v.split(/[./\\_]/))
		const isGlobMatched = split.some((pattern) => globMatch(pattern, eventName))
		if (
			!split
				.map((v) => JSON.stringify(v))
				.includes(JSON.stringify(eventName)) &&
			!isGlobMatched
		)
			return

		let name: string
		if (isGlobMatched) {
			const matched = split.find((pattern) => globMatch(pattern, eventName))
			if (!matched) {
				name = eventName
					.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
					.join('')
			} else {
				name = matched
					.map((word) => {
						if (word === '**') return 'XX'
						if (word === '*') return 'X'
						return word.charAt(0).toUpperCase() + word.slice(1)
					})
					.join('')
			}
		} else {
			name = eventName
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join('')
		}
		const _type = p.ext === '.ts' ? 'typescript' : type
		fsp
			.writeFile(filePath, boilerplate(_type, packageName, name))
			.then(() => {
				console.log(c.bgBlue(' ADDED '), `Added ${c.blue(p.base)}`)
			})
			.catch(() => {
				console.log(c.bgRed(' ERROR '), `Failed to update ${c.red(p.base)}`)
			})
	})
}
export async function watchProject(root: string, main: string) {
	const outdir = (await getSplitscriptConfig(root)).dev ?? '.ss'

	const watcher = chokidar.watch(root, {
		ignored: [`**/${outdir}/**`, '**/*.json'],
		ignoreInitial: true
	})
	const files = await glob('/**/*.{ts,js}', {
		root,
		ignore: [`${outdir}/**`, '**/node_modules/**']
	})

	deleteDirectoryRecursive(path.join(root, outdir))
	await new Promise<void>((res) => {
		let count = 0
		for (const file of files) {
			checkAndBuild(file).then(() => {
				count++
				if (count === files.length) res()
			})
		}
	})
	await run(main, outdir, root)

	watcher.on('add', async (filename) => {
		await checkAndBuild(filename, true)
	})
	watcher.on('change', async (filename) => {
		await checkAndBuild(filename, true)
	})
	watcher.on('unlink', async (filename) => {
		const parsed = path.parse(filename)
		const outfile = path.join(
			root,
			outdir ?? '.ss',
			path.relative(root, parsed.dir),
			parsed.name + '.js'
		)
		if (existsSync(outfile)) {
			console.log(c.bgRed(' DELET '), parsed.base)
			const isMain =
				path.basename(outfile) === main &&
				path.dirname(outfile) === path.join(root, outdir)

			if (isMain) return
			await fsp.rm(outfile)
			run(main, outdir, root)
		}
	})
	async function checkAndBuild(fileName: string, thenRun?: boolean) {
		const file = path.parse(fileName)
		if (file.ext !== '.js' && file.ext !== '.ts') return
		try {
			build(fileName, root).then(async () => {
				if (thenRun) {
					await run(main, outdir, root)
				}
			})
		} catch (e) {
			console.error(
				c.bgRed(' ERROR '),
				`Failed to build ${c.bold.red(fileName)}\n`,
				e
			)
		}
	}
}
