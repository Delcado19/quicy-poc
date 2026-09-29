#!/bin/sh
# qmlformat exits non-zero on a QML syntax error. Import resolution is not
# checked here (qmllint cannot see Quickshell modules); that is done live.
cd "$(dirname "$0")/.." || exit 1
status=0
for f in $(find . -name '*.qml' -not -path './.run/*'); do
  qmlformat "$f" >/dev/null 2>&1 || { echo "syntax error: $f"; status=1; }
done
exit $status
