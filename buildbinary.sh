#!/bin/bash

rm -rf build_temp
rm -rf dist/cli
mkdir build_temp
cd build_temp
git clone "https://github.com/splitscriptjs/cli" .
go install github.com/mitchellh/gox@latest
cd splitscript
gox -ldflags="-s -w" -output="../../dist/cli/{{.OS}}_{{.Arch}}" -os="darwin linux windows" -arch="amd64 arm64"

cd ../../
rm -rf build_temp
