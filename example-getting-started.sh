#!/usr/bin/env -S sh -eu

# the primary and archive filesystems
PRIMARY="root.pool storage.pool"
ARCHIVE="backup.pool"

echo 'Import the archive filesystem on attached external storage.'
echo '====================>'
zpool import ${ARCHIVE}
echo '\n'

echo 'Show the changes files.'
echo '====================>'
elephant-backup diff -a ${ARCHIVE} ${PRIMARY}
echo '\n'

echo 'Back up the primary filesystem[s] to the archive filesystem.'
echo '====================>'
elephant-backup backup -a ${ARCHIVE} ${PRIMARY}
echo '\n'

echo 'Verify the the archive filesystem with diff.'
echo 'We expect no differences.'
echo '====================>'
elephant-backup diff -a ${ARCHIVE} ${PRIMARY}
echo '\n'

echo 'export the archive filesystem.'
echo '====================>'
zpool export ${ARCHIVE}
echo '\n'
