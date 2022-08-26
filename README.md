# Elephant Backup

**Elephant Backup** is an easy backup CLI to archive any number of ZFS filesystems containing lots of snapshots to another ZFS filesystem.

## Feature

Elephant Backup archives any number of ZFS filesystems containing lots of snapshots.

- Archive your ZFS filesystems staying snapshots as it is.
- Supports the incremental backup from the previous one.
- Show the difference between the current backup and the previous one.

## Official Website

- Release Site: <https://www.npmjs.com/package/elephant-backup>
- Development Site: <https://github.com/patineboot/elephant-backup>

## Nodejs

Install node.js on Ubuntu Linux.

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Uninstall node.js on Ubuntu Linux.

```bash
sudo apt-get purge nodejs
sudo rm -r /etc/apt/sources.list.d/nodesource.list
```

See [Installing Node.js via package manager](https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions) on other platforms.

## Install

1. Install Elephant Backup

   ```bash
   npm install elephant-backup
   ```

## Usage

### Quick Start

Back up your ZFS filesystems(ZFS pool or ZFS dataset) with Elephant Backup:

```bash
elephant-backup backup -a <archive ZFS filesystem> <primary ZFS filesystem...>
```

- _\<archive filesystem\>_: the name of the ZFS filesystem that stores the primary ZFS filesystems.
- _\<original filesystem...>_: one or more names of the primary ZFS filesystem that is primary ZFS filesystem.

e.g., Back up two of the primary ZFS pools named _home.pool_ and _storage.pool_ to the _backup.pool_ pool.

```bash
sudo elephant-backup backup -a backup.pool home.pool storage.pool
```

### Snapshot

Take snapshots automatically with the `systemd` auto-launcher.

```bash
elephant-backup systemd-install <primary ZFS filesystem...>
```

- _\<archive filesystem\>_: the name of the ZFS filesystem that stores the primary ZFS filesystems.

e.g., Take automatically snapshots two of the primary ZFS pools named _home.pool_ and _storage.pool_.

```bash
sudo elephant-backup systemd-install home.pool storage.pool
```

Stop to take snapshots automatically.

```bash
sudo elephant-backup systemd-uninstall
```

### Other Usages

Run the `elephant-backup` command with the `-h` option.  
Elephant Backup has three sub-commands, `backup`, `diff`, and `snapshot` which are also available with the `-h` option.

```bash
elephant-backup -h

elephant-backup backup -h

elephant-backup diff -h

elephant-backup snapshot -h
```

## Environment

Patineboot confirmed Elephant Backup on the following software environment.
Elephant Backup is designed to run with the later or earlier versions.

Operating System:

- Ubuntu Server 22.04 with OpenZFS 2.1.2 installed

Software Programs:

- node.js v18.6.0

## For Developers

Patineboot continues to develop Elephant Backup.

Patineboot will create the new feature:

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

Move the current directory and do below.

1. Install

   - Install the development version from a local directory.

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

1. Run Elephant Backup with the debugging flag on node.js on remote machine named _ubuntu.local_.

   ```bash
   cd /home/patine/working/elephant-backup
   sudo node --inspect-brk=ubuntu.local src/main.js --help
   ```

1. Run 'Attach to remote' on the Visual Studio Code.
