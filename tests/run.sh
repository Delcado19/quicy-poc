#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
node --test tests/ && sh tests/qmlsyntax.sh
