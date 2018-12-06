#!/usr/bin/env bash
docker rm -f redis
docker pull redis:4
docker run -d -p 6379:6379 --name redis redis:4
