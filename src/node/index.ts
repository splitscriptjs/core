import path from 'path'
//@ts-ignore require.main.filename support in both ESM and CJS
import filename from 'actual.require.main.filename'

import variable from './utils/variable.js'
function root(dir?: string) {
	if (process.env.ROOT) return process.env.ROOT
	let rootPath: string = path.dirname(filename)
	if (!dir) return variable.get('root') ?? rootPath
	if (typeof dir !== 'string') throw new Error('dir must be a string')
	if (dir) {
		variable.set('root', path.resolve(dir) ?? rootPath)
	}
	return variable.get('root') ?? rootPath
}
export { EventEmitter } from './events/index.js'
export { root }
