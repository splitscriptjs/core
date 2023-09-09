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
export async function watchFunctions(root: string) {
	const watcher = chokidar.watch(path.join(root, 'functions'), {
		ignoreInitial: true
	})

	watcher.on('add', async (filePath: string, stats) => {
		const p = path.parse(filePath)
		if (stats?.size !== 0) return
		const type = await getType()
		const ss = await getSplitscriptConfig()
		if (!ss.packages) {
			console.log(c.bgRed(` ERROR `), `Invalid ss.json`)
			process.exit(1)
		}

		const eventFolder = getEventFolder(filePath)
		if (!validEventFolder(ss, eventFolder)) return

		const eventName = getEventName(filePath, eventFolder)
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
		if (
			!validEvents
				.map((v) => JSON.stringify(v.split(/[./\\_]/)))
				.includes(JSON.stringify(eventName))
		)
			return
		const _type = p.ext === '.ts' ? 'typescript' : type
		fsp
			.writeFile(
				filePath,
				boilerplate(
					_type,
					packageName,
					eventName
						.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
						.join('')
				)
			)
			.then(() => {
				console.log(c.bgBlue(' ADDED '), `Added ${c.blue(p.base)}`)
			})
			.catch(() => {
				console.log(c.bgRed(' ERROR '), `Failed to update ${c.red(p.base)}`)
			})
	})
}
export async function watchProject(root: string, main: string) {
	const outdir = (await getSplitscriptConfig()).out ?? '.ss'

	const watcher = chokidar.watch(root, {
		ignored: [`**/${outdir}/**`, '**/*.json'],
		ignoreInitial: true
	})
	const files = await glob('/**/*.{ts,js}', {
		root,
		ignore: [`${outdir}/**`, '**/node_modules/**']
	})

	deleteDirectoryRecursive(path.join(root, '.ss'))
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
