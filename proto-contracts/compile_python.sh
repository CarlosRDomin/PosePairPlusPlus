#!/bin/bash

INPUT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
OUT_DIR="$INPUT_DIR/../pose-estimation"

python -m grpc_tools.protoc -I=$INPUT_DIR --python_out=$OUT_DIR --grpc_python_out=$OUT_DIR $INPUT_DIR/*.proto
echo "Generated Python protos at '$OUT_DIR'"
