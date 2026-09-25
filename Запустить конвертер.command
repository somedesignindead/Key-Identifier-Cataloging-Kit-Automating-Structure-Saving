#!/bin/zsh
cd -- "${0:A:h}" || exit 1
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
if ! command -v node >/dev/null; then
  echo 'Установите Node.js 20 или новее, затем повторите запуск.'
  read '?Нажмите Enter для выхода.'
  exit 1
fi
if [ ! -d node_modules/playwright ]; then
  echo 'Сначала выполните npm ci в папке проекта (см. README.md).'
  read '?Нажмите Enter для выхода.'
  exit 1
fi
node converter/server.mjs
read '?Нажмите Enter для выхода.'
