#!/bin/bash

cp /etc/resolv.conf /tmp/resolv.conf
su -c 'umount /etc/resolv.conf'
cp /tmp/resolv.conf /etc/resolv.conf
sed -i 's/DAEMON_ARGS=.*/DAEMON_ARGS=""/' /etc/init.d/expressvpn
service expressvpn restart
/usr/bin/expect /tmp/expressvpnActivate.sh
expressvpn preferences set auto_connect true
expressvpn preferences set preferred_protocol auto
expressvpn preferences set lightway_cipher auto

node dist/main &
APP_PID=$!

sleep 5

node dist/main speed-test

exec "$@"