export function tsBoilerplate(packageName: string, eventName: string) {
	return `import { Events } from '${packageName}';\nexport default async function (event: Events.${eventName}) {\n\n}`
}
export function esmBoilerplate(packageName: string, eventName: string) {
	return `/** @typedef {import('${packageName}').Events.${eventName}} Event */\n/** @param {Event} event */\n\nexport default async function (event) {\n\n}`
}
export function cjsBoilerplate(packageName: string, eventName: string) {
	return `/** @typedef {import('${packageName}').Events.${eventName}} Event */\n/** @param {Event} event */\n\nmodule.exports = async function (event) {\n\n}`
}
export default function boilerplate(
	type: string,
	packageName: string,
	eventName: string
) {
	if (type === 'module') return esmBoilerplate(packageName, eventName)
	else if (type === 'commonjs') return cjsBoilerplate(packageName, eventName)
	else if (type === 'typescript') return tsBoilerplate(packageName, eventName)

	return ''
}
