#!/usr/bin/env -S sh -eu

UNIT_NAME='elephant-backup-snapshot'
SYSTEMD_DIR='/etc/systemd/system/'

if [ $1 = 'enable' ]; then
    echo "Copy the service and timer unit files."
    cp ${UNIT_NAME}.timer ${SYSTEMD_DIR}
    cp ${UNIT_NAME}.service ${SYSTEMD_DIR}

    echo "Replacing POOLS_REPLACEMENT in the service unit file."
    # remove subcommand from the arguments of this command.
    POOLS=`echo @* | tr -d 'enable'`
    # replace POOLS_REPLACEMENT to the names of the actual ZFS pools. 
    sed -i -e "s/POOLS_REPLACEMENT/${POOLS}/g' ${SYSTEMD_DIR}${UNIT_NAME}.service

    echo "Enable the Elephant Backup systemd unit."
    systemd enable ${UNIT_NAME}
    exit 0
fi

if [ $1 = 'disable' ]; then
    echo "Disable the Elephant Backup systemd unit."
    systemd disable ${UNIT_NAME}
    rm ${SYSTEMD_DIR}${UNIT_NAME}.service
    rm ${SYSTEMD_DIR}${UNIT_NAME}.timer
    exit 0
fi
