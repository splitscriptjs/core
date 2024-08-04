#!/bin/node

const { spawn } = require('node:child_process')
const path = require('node:path')

let platform = ''
let arch = ''
let fname = ''
switch (process.platform) {
	case 'win32':
		platform = 'windows'
		break
	case 'linux':
	case 'darwin':
		platform = process.platform
		break
	default:
		throw 'Unsupported os'
}
switch (process.arch) {
	case 'arm64':
		arch = process.arch
		break
	case 'x64':
		arch = 'amd64'
		break
	default:
		throw 'Unsupported architecture'
}
if (platform === 'windows') {
	fname = `${platform}_${arch}.exe`
} else {
	fname = `${platform}_${arch}`
}
spawn(path.join(__dirname, fname), [...process.argv.slice(2)], {
	stdio: 'inherit'
})
