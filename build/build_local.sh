#!/bin/bash

pm2 stop 09-dm || true
pm2 start build/pm2_local.yaml
