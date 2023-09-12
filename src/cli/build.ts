import c from 'ansi-colors'
import esbuild from 'esbuild'
import path from 'path'
import { getSplitscriptConfig } from './utils'
export async function build(file: string, root: string, out?: string) {
	const start = performance.now()
	const outdir = out ?? (await getSplitscriptConfig(root)).dev
	const parsed = path.parse(file)

	try {
		esbuild.buildSync({
			entryPoints: [file],
			outfile: path.join(
				root,
				outdir ?? '.ss',
				path.relative(root, parsed.dir),
				parsed.ext === '.ts' ? parsed.name + '.js' : parsed.base
			),
			allowOverwrite: true,
			logLevel: 'error',
			target: ['esnext']
		})
	} catch (e) {
		console.log(
			c.bgRed(' ERROR '),
			c.bold.red(` Failed to build ${parsed.base}`),
			e
		)
	} finally {
		console.log(
			c.bgBlue(' BUILD '),
			`${parsed.base}`,
			c.green(`${(performance.now() - start).toFixed(3)} ms`)
		)
		return
	}
}
