#!/usr/bin/env bash

set -euo pipefail

if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  # Cursor's non-interactive shell can keep /exec-daemon ahead of nvm.
  # shellcheck disable=SC1091
  source "${HOME}/.nvm/nvm.sh"
  nvm install 24
  nvm use 24
  export PATH="${NVM_BIN}:${PATH}"
else
  export PATH="${HOME}/.nvm/versions/node/v24.16.0/bin:${PATH}"
fi

hash -r
node --version
npm --version
node -e "const major = Number(process.versions.node.split('.')[0]); if (major !== 24) { throw new Error('Expected Node 24, got ' + process.version); }"
npm install
npx playwright install chromium
