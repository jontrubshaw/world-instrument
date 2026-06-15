#!/usr/bin/env bash

set -euo pipefail

if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  # Cursor's non-interactive shell can shadow nvm; load it before npm runs.
  # shellcheck disable=SC1091
  source "${HOME}/.nvm/nvm.sh"
  nvm use 24
else
  export PATH="${HOME}/.nvm/versions/node/v24.16.0/bin:${PATH}"
fi

node --version
npm --version
npm install
npx playwright install --with-deps chromium
