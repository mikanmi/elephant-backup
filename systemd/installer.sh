#!/usr/bin/env -S bash -eu -x

UNIT_NAME='elephant-backup-systemd'
SYSTEMD_DIR='/etc/systemd/system/'

SCRIPT_DIR=`realpath ./`"/systemd/"
POOLS=${@:2:($#-1)}

if [ $1 = 'enable' ]; then
    echo "Copy the service and timer unit files."
    cp ${SCRIPT_DIR}${UNIT_NAME}.timer ${SYSTEMD_DIR}
    cp ${SCRIPT_DIR}${UNIT_NAME}.service ${SYSTEMD_DIR}

    echo "Replacing POOLS_REPLACEMENT in the service unit file."
    # remove subcommand from the arguments of this command.
    # POOLS=`echo @{*} | tr -d 'enable'`
    # replace POOLS_REPLACEMENT to the names of the actual ZFS pools. 
    sed -i -e "s/POOLS_REPLACEMENT/${POOLS#enable}/g" ${SYSTEMD_DIR}${UNIT_NAME}.service

    echo "Enable the Elephant Backup systemd unit."
    systemctl enable --now ${UNIT_NAME}.timer
    exit 0
fi

if [ $1 = 'disable' ]; then
    echo "Disable the Elephant Backup systemd unit."
    systemctl disable ${UNIT_NAME}.timer
    rm ${SYSTEMD_DIR}${UNIT_NAME}.service
    rm ${SYSTEMD_DIR}${UNIT_NAME}.timer
    exit 0
fi