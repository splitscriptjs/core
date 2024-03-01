import EventEmitter from 'node:events'
import { HandleFunction } from '../'

/**
 * **Internal**
 * Used to store global variables like root and error handlers
 */
export const variable: { root?: string; handleFunctions?: HandleFunction[] } =
	{}
export const emitter = new EventEmitter()
/**
 * **Internal**
 * Used to set a global variable
 */
export function set<Key extends keyof typeof variable>(
	key: Key,
	value: (typeof variable)[Key]
) {
	variable[key] = value
	emitter.emit('set', key, value)
}
/**
 * **Internal**
 * Used to get a global variable
 */
export function get<Key extends keyof typeof variable>(
	key: Key
): (typeof variable)[Key] {
	return variable[key]
}

export default { variable, emitter, set, get }
