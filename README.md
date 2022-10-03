# Elephant Backup

**Elephant Backup** is an easy backup CLI to archive any number of ZFS filesystems containing lots of snapshots to another ZFS filesystem.

## Feature

Elephant Backup archives any number of ZFS filesystems containing lots of snapshots.

- Archive your ZFS filesystems staying snapshots as it is.
- Supports the incremental backup from the previous one.
- Show the difference between the current archive and the previous one.
- Take a one-shot snapshot and snapshots automatically every hour.

## Website

Development Site: <https://github.com/patineboot/elephant-backup>

Released Elephant Backup with `npm` : <https://www.npmjs.com/package/elephant-backup>

## Install

### Install Elephant Backup

   ```bash
   npm install elephant-backup
   ```

Note:

Install `npm` with the `apt` package manager if `npm` does not exist on Ubuntu.  
Install `node` with `npm` and **reboot** after installing `npm`.

   ```bash
   apt install npm
   npm --global install node
   reboot
   ```

## Usage

### Quick Start

Archive ZFS filesystems, meaning ZFS pool or ZFS dataset, with the command line:

```bash
elephant-backup backup -a <archive filesystem> <primary filesystem...>
```

- _\<archive filesystem\>_: The name of the ZFS filesystem, which stores the primary ZFS filesystems.
- _\<primary filesystem...>_: One or more names of the ZFS filesystem which are archived.

e.g., archive two of the primary ZFS pools named _root.pool_ and _storage.pool_ to the _archive.pool_ archive ZFS pool.

```bash
sudo elephant-backup backup -a archive.pool root.pool storage.pool
```

### Snapshot

Take snapshots automatically with the `systemd` timer.

```bash
elephant-backup systemd-install <primary filesystem...>
```

- _\<primary filesystem\>_: One or more names of the ZFS filesystem which are taken automatically.

e.g., automatically take snapshots named _root.pool_ and _storage.pool_.

- Start to take snapshots automatically.
   ```bash
   sudo elephant-backup systemd-install root.pool storage.pool
   ```

- Stop taking snapshots automatically.
   ```bash
   sudo elephant-backup systemd-uninstall
   ```

### Other Usages

Run the `elephant-backup` command with the `-h` option.  
Elephant Backup has three sub-commands and two auto-snapshot above.  
See more details using the `-h` option with sub-command.

```bash
elephant-backup -h

elephant-backup backup -h

elephant-backup diff -h

elephant-backup snapshot -h
```

## Environment

Elephant Backup runs on the following software environment or later versions.

Operating System:

- Ubuntu Server 22.04.1 LTS with OpenZFS 2.1.4 installed

Software Programs:

- node.js v18.6.0

## For Developers

I have developed Elephant Backup currently.

Will arrive the new feature:

- purging some existing snapshots from remaining size.

```bash
$ zfs list -o space -r rpool
NAME                       AVAIL   USED  USEDSNAP  USEDDS  USEDREFRESERV  USEDCHILD
rpool                      59.1G  7.84G       21K    109K              0      7.84G
rpool@snap1                    -    21K         -       -              -          -
rpool/ROOT                 59.1G  4.78G         0     31K              0      4.78G
rpool/ROOT@snap1               -      0         -       -              -          -
```

The _USED_ property of snapshots is the size which snapshot consume.

We estimate the volume size of the ZFS pool from the _USED_ property of to be purged snapshot.

### Development version

1. Install

   - Install the development version from a local directory.

      Move the directory containing Elephant Backup, and install it.

      ```bash
      cd working/elephant-backup
      npm install ../elephant-backup
      ```

   - Install the development version from GitHub.

      ```bash
      npm install patineboot/elephant-backup
      ```

1. Run the development version.

   ```bash
   sudo ./elephant-backup/src/main.js --help
   ```

### Debug

Debug Elephant Backup with the remote debug.

e.g.,

- Remote Machine Name: _ubuntu.local_
- Elephant Backup Path on Remote: _/home/patine/working/elephant-backup_

The remote debug procedure:

1. Debug Machine: Change `remoteRoot` on the _.vscode/launch.json_ file.

   ```json
   "remoteRoot": "/home/patine/working/elephant-backup"
   ```

1. Remote Machine: Run Elephant Backup with the debugging flag on node.js on the .

   ```bash
   cd /home/patine/working/elephant-backup
   sudo node --inspect-brk=ubuntu.local src/main.js --help
   ```

1. Debug Machine: Select 'Attach to remote' on the Visual Studio Code.

### Test

Setup the test environment on your machine.

1. Move the current directory to _elephant-backup_.
1. Install `node.js` with version 18.0.0 or higher.

```bash
npm install node@18.9.0
```

Run the test.

1. Move the current directory to _elephant-backup_.
1. Run the test on the test environment.

```bash
npx node --test
```
