import EventEmitter from 'node:events'
import { HandleFunction } from '../'

export const variable: { root?: string; handleFunctions?: HandleFunction[] } =
	{}
export const emitter = new EventEmitter()
export function set<Key extends keyof typeof variable>(
	key: Key,
	value: (typeof variable)[Key]
) {
	variable[key] = value
	emitter.emit('set', key, value)
}
export function get<Key extends keyof typeof variable>(
	key: Key
): (typeof variable)[Key] {
	return variable[key]
}

export default { variable, emitter, set, get }
