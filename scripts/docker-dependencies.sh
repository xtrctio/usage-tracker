#!/usr/bin/env bash
docker rm -f redis
docker pull redis:5
docker run -d -p 6379:6379 --name redis redis:5

docker rm -f firestore-emulator
docker pull xtrctio/firestore-emulator:latest
docker run -d --name firestore-emulator -p 8080:8080 -e FIRESTORE_PROJECT_ID=xtrctio-testing xtrctio/firestore-emulator:latest
