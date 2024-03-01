import c from 'ansi-colors'
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
export let child: ChildProcessWithoutNullStreams | undefined
let pids: (number | undefined)[] = []
export async function run(main: string, outdir: string, root: string) {
	const psList = await import('ps-list')
	const processes = (await psList.default()).filter(
		(proc) =>
			proc.name === 'node.exe' &&
			pids.includes(proc.ppid) &&
			proc.ppid !== process.pid &&
			proc.pid !== process.pid
	)

	processes.forEach((proc) => {
		process.kill(proc.pid)
	})
	pids = []

	if (child) {
		child.on('exit', function () {
			child = undefined
		})
	}

	const parsed = path.parse(main)

	if (!existsSync(path.join(root, outdir, parsed.name + '.js')))
		return console.error(c.bgRed(' ERROR '), `Could not find ${main}`)
	child = spawn(`node`, [path.join(root, outdir, parsed.name + '.js')], {
		shell: true,
		env: {
			ROOT: path.join(root, outdir),
			CONFIG_LOCATION: root
		}
	})
	pids.push(child.pid)
	console.log(c.bgGreen(' START '), path.basename(main))
	if (child.stdout && child.stderr) {
		child.stdout.on('data', (chunk) => {
			const now = new Date()
			const formattedDate = `${now.getMonth() + 1}/${now.getDate()}/${now
				.getFullYear()
				.toString()
				.substr(-2)} ${now.getHours()}:${now
				.getMinutes()
				.toString()
				.padStart(2, '0')}`

			process.stdout.write(
				`${c.bgGreen(' PRINT ')} ${c.green(formattedDate)} ${chunk}`
			)
		})
		child.stderr.on('data', (chunk) => {
			const now = new Date()
			const formattedDate = `${now.getMonth() + 1}/${now.getDate()}/${now
				.getFullYear()
				.toString()
				.substr(-2)} ${now.getHours()}:${now
				.getMinutes()
				.toString()
				.padStart(2, '0')}`

			process.stderr.write(
				`${c.bgRed(' CRASH ')} ${formattedDate.toString()} ${chunk}`
			)
			process.exit(1)
		})
	} else {
		console.log(
			c.bgYellow(' DEBUG '),
			`Cannot read logs of ${c.gray(path.basename(main))}`
		)
	}
}
