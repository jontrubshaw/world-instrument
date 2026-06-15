#!/usr/bin/env bash

set -euo pipefail

if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  # Cursor's non-interactive shell can keep /exec-daemon ahead of nvm.
  # shellcheck disable=SC1091
  source "${HOME}/.nvm/nvm.sh"
  nvm use 24
  export PATH="${NVM_BIN}:${PATH}"
else
  export PATH="${HOME}/.nvm/versions/node/v24.16.0/bin:${PATH}"
fi

hash -r
node --version
npm --version
npm install
npx playwright install --with-deps chromium
