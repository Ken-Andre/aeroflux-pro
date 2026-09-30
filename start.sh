#!/bin/sh
cd "$(dirname "$0")"
(sleep 1; xdg-open http://localhost:8080 2>/dev/null || open http://localhost:8080) &
node server.js
