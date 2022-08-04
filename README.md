# Elephant Backup

**Elephant Backup** is an easy backup CLI to archive any number of ZFS filesystems containing lots of snapshots to another ZFS filesystem.

## Feature

Elephant Backup archives any number of ZFS filesystems containing lots of snapshots.

- Archive your ZFS filesystems staying snapshots as it is.
- Supports the incremental backup from the previous one.
- Show the difference between the current backup and the previous one.

## Official Website

Release Site: <https://www.npmjs.com/package/elephant-backup>

Development Site: <https://github.com/patineboot/elephant-backup>

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

1. Install Dependent Commands

   Elephant Backup depends on the 'Pipe Viewer' and 'zfs-auto-snapshot' commands.  
   e.g., Install them on Ubuntu Linux.

   ```bash
   apt install pv zfs-auto-snapshot
   ```

   The websites of the dependent commands:
   - Pipe Viewer: <https://www.ivarch.com/programs/pv.shtml>
   - zfs-auto-snapshot: <https://github.com/zfsonlinux/zfs-auto-snapshot>

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

**Note**: For the first time, configure the archive ZFS filesystem.

- Disable the _com.sun:auto-snapshot_ property on the archive ZFS filesystem.
- Remove all of the snapshots on the archive ZFS filesystem before first.

Disable the com.sun:auto-snapshot property:

```bash
sudo zfs set com.sun:auto-snapshot=false <archive ZFS filesystem>
```

### Other Usages

Run the `elephant-backup` command with the `-h` option.  
Elephant Backup has two sub-commands, `backup` and `diff`, which are also available with the `-h` option.

```bash
elephant-backup -h

elephant-backup backup -h

elephant-backup diff -h
```

## Environment

Patineboot confirmed Elephant Backup on the following software environment.
Elephant Backup is designed to run with the later or earlier versions.

Operating System:

- Ubuntu Server 22.04 with OpenZFS 2.1.2 installed

Software Programs:

- node.js v18.6.0
- pv 1.6.6
- zfs-auto-snapshot 1.2.4

## Developer of Elephant Backup

Patineboot continues to develop Elephant Backup.

### Development version

Move the current directory and do below.

1. Install

   - Install the development version from a local directory.

      ```bash
      cd elephant-backup
      npm install ../elephant-backup
      ```

   - Install the development version from GitHub.

      ```bash
      npm install patineboot/elephant-backup
      ```

1. Run the development version.

   ```bash
   npm start
   ```

Login again if install the node.js binary application with the _--global_ option.
