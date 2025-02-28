#!/bin/bash

if [ -f .env ]; then
  source .env
else
  echo "Error: .env file not found"
  exit 1
fi

if [ -z "$EXPRESSVPN_ACTIVATION_CODE" ]; then
  echo "Error: EXPRESSVPN_ACTIVATION_CODE is not set in .env file"
  exit 1
fi

if [ -z "$SERVER" ]; then
  echo "Error: SERVER is not set in .env file"
  exit 1
fi

if [ -z "$PREFERRED_PROTOCOL" ]; then
  echo "Error: PREFERRED_PROTOCOL is not set in .env file"
  exit 1
fi

if [ -z "$LIGHTWAY_CIPHER" ]; then
  echo "Error: LIGHTWAY_CIPHER is not set in .env file"
  exit 1
fi

trap 'echo "Interrupt detected, shutting down containers..."; docker compose down; exit 1' INT

docker compose build
docker compose up express-vpn