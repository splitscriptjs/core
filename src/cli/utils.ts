import colors from 'ansi-colors'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
export async function isTs(_root?: string): Promise<boolean> {
	let fileString = '{}'
	if (fs.existsSync(_root ? path.join(_root, 'ss.json') : './ss.json')) {
		fileString = await fsp.readFile(
			_root ? path.join(_root, 'ss.json') : './ss.json',
			'utf-8'
		)
	}
	let ss = JSON.parse(fileString)

	return (
		fs.existsSync(path.join(_root ?? root, 'tsconfig.json')) || ss.typescript
	)
}
export async function createFoldersRecursive(
	absolutePath: string
): Promise<void> {
	const folders = path.normalize(absolutePath).split(path.sep)
	let currentPath = folders.shift() as string
	for (const folder of folders) {
		currentPath = path.join(currentPath, folder)
		try {
			await fsp.mkdir(currentPath)
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
		}
	}
}
export async function getValidEvents(pckg: string): Promise<string[]> {
	let fileString = '{}'
	if (fs.existsSync('./ss.json')) {
		fileString = await fsp.readFile('./ss.json', 'utf-8')
	}
	let ss = JSON.parse(fileString)
	if (ss.packages && !ss.packages[pckg]) {
		console.error(colors.red(`package ${colors.green(pckg)} not found`))
		process.exit(1)
	}
	return ss.packages ? ss.packages[pckg]?.validEvents : []
}
export async function getPackageName(pckg: string): Promise<string[]> {
	let fileString = '{}'
	if (fs.existsSync('./ss.json')) {
		fileString = await fsp.readFile('./ss.json', 'utf-8')
	}
	let ss = JSON.parse(fileString)
	return ss?.packages[pckg]?.packageName
}
export async function getType(root?: string): Promise<string> {
	let pckg = '{}'
	if (
		fs.existsSync(root ? path.join(root, 'package.json') : './package.json')
	) {
		pckg = await fsp.readFile(
			root ? path.join(root, 'package.json') : './package.json',
			'utf-8'
		)
	}
	const obj = JSON.parse(pckg)

	return obj?.type ?? 'commonjs'
}
export function getEventFolder(filepath: string): string {
	let currentDir = path.dirname(filepath)
	while (path.basename(currentDir) !== 'functions') {
		currentDir = path.dirname(currentDir)
	}
	return path.relative(currentDir, path.dirname(filepath)).split(path.sep)[0]
}
export function validEventFolder(
	json: { [key: string]: any },
	eventFolder: string
): boolean {
	return eventFolder && json && json.packages && !!json.packages[eventFolder]
}
export function getEventName(
	filepath: string,
	currentFunctionPackage: string,
	root?: string
): string[] {
	const a = path.relative(
		root
			? path.join(root, 'functions', currentFunctionPackage)
			: path.join('./functions', currentFunctionPackage),
		filepath
	)
	return path.dirname(a).split(path.sep)
}
export async function getExistingEvents(pckg: string) {
	const valid = await getValidEvents(pckg)
	const events = valid.map((event) => {
		return event
			.trim()
			.toLowerCase()
			.split(/[./\\_]/)
	})
	const funcRoot = path.join(root, 'functions', pckg)
	const exists: string[] = []
	for (const event of events) {
		if (
			fs.existsSync(path.join(funcRoot, ...event)) &&
			(await fsp.readdir(path.join(funcRoot, ...event))).length !== 0
		) {
			exists.push(event.join('/'))
		}
	}
	return exists
}
export async function getSplitscriptConfig(root?: string) {
	let fileString = '{}'
	if (fs.existsSync(root ? path.join(root, 'ss.json') : 'ss.json')) {
		fileString = await fsp.readFile(
			root ? path.join(root, 'ss.json') : 'ss.json',
			'utf-8'
		)
	}
	let ss = JSON.parse(fileString)
	return ss
}
export function deleteDirectoryRecursive(directoryPath: string) {
	if (fs.existsSync(directoryPath)) {
		fs.readdirSync(directoryPath).forEach((file) => {
			const curPath = path.join(directoryPath, file)
			if (fs.lstatSync(curPath).isDirectory()) {
				// Recursively delete subdirectories
				deleteDirectoryRecursive(curPath)
			} else {
				// Delete files
				fs.unlinkSync(curPath)
			}
		})

		// Finally, remove the main directory
		fs.rmdirSync(directoryPath)
	}
}
