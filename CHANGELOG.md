# 2.3.1

Add documentation comments to `handleError()`

# 2.3.0

Add handleError function

# 2.2.2

Allow wildcard `**` at the end of events

Watches for functions watches correct folder when passing a folder

# 2.2.1

Add wildcards to emitter.listeners

# 2.2.0

Allow wildcard events

Move prettier config to `package.json`

# 2.1.2

Will not catch application errors when sending an event

# 2.1.1

add esbuild to dependency list

# 2.1.0

add `splitscript build <folder>` to build all files in that folder

setting dev/build in ss.json works relative to where you ran the command from

# 2.0.5

JSON stringify `ss.json` with tabs

# 2.0.4

upgrade build target

# 2.0.3

can use splitscript dev [file/folder] without running before

by adding CONFIG_LOCATION enviroment variable

# 2.0.2

will not restart process in splitscript dev if main file is deleted/renamed

# 2.0.1

splitscript dev will run built file

# 2.0.0

Added watching and typescript building to splitscript dev

Can set `ROOT` enviroment variable to override the root set in `root()` or the automatic root finding

# 1.2.0

Added `root()` - set and get the project root

# 1.1.0

typesafety with `EventEmitter` validEvents - written by [rjansen](https://rjansen.de/)

# 1.0.5

Update `README.md`

# 1.0.4

Fixed exports

# 1.0.3

Fixed type exports

# 1.0.2

Update `README.md`

# 1.0.1

Update `README.md`

# 1.0.0

First version (CLI, EventEmitter)
