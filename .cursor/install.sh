#!/usr/bin/env bash
set -euo pipefail

if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  . "$HOME/.nvm/nvm.sh"
  nvm install 24
  nvm use 24
else
  export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
fi

node -e "const major = Number(process.versions.node.split('.')[0]); if (major !== 24) { throw new Error('Expected Node 24, got ' + process.version); }"
npm install
npm run setup:browsers:with-deps
