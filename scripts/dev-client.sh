#!/usr/bin/env bash
cd "$(dirname "$0")/../apps/client-desktop"
exec npm run tauri dev
