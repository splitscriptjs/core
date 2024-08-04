import path from 'node:path'

//@ts-ignore require.main.filename support in both ESM and CJS
import filename from 'actual.require.main.filename'

import variable from './utils/variable.js'
/**
 * Gets or sets the root directory for running an app
 */
function root(dir?: string): string {
	if (process.env.ROOT) return process.env.ROOT
	let rootPath: string = path.dirname(filename)
	if (!dir) return variable.get('root') ?? rootPath
	if (typeof dir !== 'string') throw new Error('dir must be a string')
	if (dir) {
		variable.set('root', path.resolve(dir) ?? rootPath)
	}
	return variable.get('root') ?? rootPath
}
/** **Internal** - function type to be used for handling errors */
type HandleFunction = (data: object, error: unknown) => unknown
/**
 * Catch all errors from listener functions
 */
function handleError(
	/** function to run when a listener errors */ handleFunction: HandleFunction
) {
	const handleFunctions = variable.get('handleFunctions') ?? []
	handleFunctions?.push(handleFunction)
	variable.set('handleFunctions', handleFunctions)
}
export { EventEmitter } from './events/index.js'
export { root, handleError }
export type { HandleFunction }
