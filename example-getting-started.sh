#!/usr/bin/env -S sh -eu

# the primary and archive filesystems
PRIMARIES="root.pool storage.pool"
ARCHIVE="archive.pool"

echo 'Import the archive filesystem on attached external storage.'
echo '====================>'
set +e
zpool import ${ARCHIVE}
set -e
echo '\n'

echo 'Mount the archive filesystem.'
echo '====================>'
zfs load-key -a
zfs mount -a
echo '\n'

echo 'Show the changes files.'
echo '====================>'
elephant-backup diff -a ${ARCHIVE} ${PRIMARIES}
echo '\n'

echo 'Back up the primary filesystem[s] to the archive filesystem.'
echo '====================>'
elephant-backup backup -a ${ARCHIVE} ${PRIMARIES}
echo '\n'

echo 'Verify the the archive filesystem using the diff subcommand.'
echo 'We expect no differences.'
echo '====================>'
elephant-backup diff -a ${ARCHIVE} ${PRIMARIES}
for PRIMARY in ${PRIMARIES}
do
rsync -n -carv --delete /${PRIMARY}/ /${ARCHIVE}/${PRIMARY}/
done
echo '\n'
