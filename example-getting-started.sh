#!/usr/bin/env sh

# the primary and archive filesystems
PRIMARY="root.pool storage.pool"
ARCHIVE="backup.pool"

# import the archive filesystem on attached external storage.
zpool import ${ARCHIVE}

# show the changes files.
elephant-backup diff -a ${ARCHIVE} ${PRIMARY}

# back up the primary filesystem[s] to the archive filesystem.
elephant-backup backup -a ${ARCHIVE} ${PRIMARY}

# verify the the archive filesystem with diff.
# expect no differences.
elephant-backup diff -a ${ARCHIVE} ${PRIMARY}

# export the archive filesystem.
zpool export backup.pool
