import path from 'node:path';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import colors from 'ansi-colors';

const root = process.cwd();
export async function isTs(): Promise<boolean> {
	let fileString = '{}';
	if (fs.existsSync('./ss.json')) {
		fileString = await fsp.readFile('./ss.json', 'utf-8');
	}
	let ss = JSON.parse(fileString);

	return fs.existsSync(path.join(root, 'tsconfig.json')) || ss.typescript;
}
export async function createFoldersRecursive(
	absolutePath: string
): Promise<void> {
	const folders = path.normalize(absolutePath).split(path.sep);
	let currentPath = folders.shift() as string;
	for (const folder of folders) {
		currentPath = path.join(currentPath, folder);
		try {
			await fsp.mkdir(currentPath);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
		}
	}
}
export async function getValidEvents(pckg: string): Promise<string[]> {
	let fileString = '{}';
	if (fs.existsSync('./ss.json')) {
		fileString = await fsp.readFile('./ss.json', 'utf-8');
	}
	let ss = JSON.parse(fileString);
	if (ss.packages && !ss.packages[pckg]) {
		console.error(colors.red(`package ${colors.green(pckg)} not found`));
		process.exit(1);
	}
	return ss.packages ? ss.packages[pckg]?.validEvents : [];
}
export async function getPackageName(pckg: string): Promise<string[]> {
	let fileString = '{}';
	if (fs.existsSync('./ss.json')) {
		fileString = await fsp.readFile('./ss.json', 'utf-8');
	}
	let ss = JSON.parse(fileString);
	return ss?.packages[pckg]?.packageName;
}
export async function getType(): Promise<string> {
	let pckg = '{}';
	if (fs.existsSync('./package.json')) {
		pckg = await fsp.readFile('./package.json', 'utf-8');
	}
	const obj = JSON.parse(pckg);

	return obj?.type ? obj.type : 'commonjs';
}
export function getCurrentFunctionPackage(filepath: string): string {
	let currentDir = path.dirname(filepath);
	while (path.basename(currentDir) !== 'functions') {
		currentDir = path.dirname(currentDir);
	}
	return path.relative(currentDir, path.dirname(filepath)).split(path.sep)[0];
}
export function getEventName(
	filepath: string,
	currentFunctionPackage: string
): string {
	const a = path.relative(
		path.join('./functions', currentFunctionPackage),
		filepath
	);
	return path
		.dirname(a)
		.split(path.sep)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join('');
}
export async function getExistingEvents(pckg: string) {
	const valid = await getValidEvents(pckg);
	const events = valid.map((event) => {
		return event
			.trim()
			.toLowerCase()
			.split(/[./\\_]/);
	});
	const funcRoot = path.join(root, 'functions', pckg);
	const exists: string[] = [];
	for (const event of events) {
		if (
			fs.existsSync(path.join(funcRoot, ...event)) &&
			(await fsp.readdir(path.join(funcRoot, ...event))).length !== 0
		) {
			exists.push(event.join('/'));
		}
	}
	return exists;
}
