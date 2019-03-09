#!/bin/sh

cd "$(dirname "$0")"  # cd to script directory
echo "Installing all dependencies in `pwd`"
npm i

cd client
echo "Installing all dependencies in `pwd`"
npm i

cd ../server
echo "Installing all dependencies in `pwd`"
npm i