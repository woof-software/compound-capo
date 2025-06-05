#!/usr/bin/env bash

set -eo pipefail

coverage_hardhat() {
    local memory_limit="$1"
    if [[  -z "$memory_limit" ]]; then
        TS_NODE_TRANSPILE_ONLY=true pnpm hardhat coverage
    elif [[ "$memory_limit" =~ ^[1-9][0-9]*$ ]]; then
        NODE_OPTIONS=\"--max-old-space-size=$memory_limit\" TS_NODE_TRANSPILE_ONLY=true pnpm hardhat coverage --max-memory $memory_limit
    else
        echo "The second passed parameter is unknown. Expected a positive number or nothing."
        echo
        return 1
    fi
}

echo
echo "Generating coverage..."

pnpm clean:cov
if [ -z "$1" ]; then
    coverage_hardhat
elif [ "$1" = "h" ]; then
    coverage_hardhat "$2"
else
    echo "The first passed parameter is unknown."
    echo
    exit 1
fi

echo "Coverage generated."
echo
