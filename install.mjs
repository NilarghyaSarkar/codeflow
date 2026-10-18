#!/usr/bin/env node
import { constants } from 'node:fs';
import { access, cp, lstat, mkdir, readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
if (args.includes('--help')) {
    console.log('Usage: node install.mjs [--dest <skill-directory>]');
    console.log('Default: ~/.agents/skills/codeflow (all projects in Codex and OpenCode).');
    process.exit(0);
}
if (args.length !== 0 && !(args.length === 2 && args[0] === '--dest' && args[1])) {
    console.error('Usage: node install.mjs [--dest <skill-directory>]');
    process.exit(1);
}

const source = fileURLToPath(new URL('./codeflow/', import.meta.url));
const destination = args.length ? resolve(args[1]) : join(homedir(), '.agents', 'skills', 'codeflow');

async function samePackage(left, right) {
    const entries = await readdir(left, { withFileTypes: true });
    const installed = await readdir(right);
    if (entries.length !== installed.length) return false;
    for (const entry of entries) {
        const leftPath = join(left, entry.name);
        const rightPath = join(right, entry.name);
        const stat = await lstat(rightPath);
        if (stat.isSymbolicLink()) return false;
        if (entry.isDirectory()) {
            if (!stat.isDirectory() || !(await samePackage(leftPath, rightPath))) return false;
        } else if (!stat.isFile() || !(await readFile(leftPath)).equals(await readFile(rightPath))) {
            return false;
        }
    }
    return true;
}

try {
    await access(join(source, 'SKILL.md'), constants.R_OK);
    let existing;
    try {
        existing = await lstat(destination);
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
    if (existing) {
        if (!existing.isSymbolicLink() && existing.isDirectory() && await samePackage(source, destination)) {
            console.log(`CodeFlow is already installed: ${destination}`);
            process.exit(0);
        }
        throw new Error(`Destination already exists: ${destination}. It was left unchanged. Choose another --dest or explicitly remove the old installation before replacing it.`);
    }
    // mkdir without recursive reserves the destination and refuses concurrent
    // installs or unmanaged paths. Copy the runtime, never a checkout symlink.
    await mkdir(resolve(destination, '..'), { recursive: true });
    await mkdir(destination);
    for (const entry of await readdir(source)) {
        await cp(join(source, entry), join(destination, entry), { recursive: true, force: false, errorOnExist: true });
    }
    console.log(`Installed CodeFlow 3.1.0: ${destination}`);
    console.log('Available in existing and new projects on your next turn.');
    console.log('Try: Use $codeflow to diagram this project.');
} catch (error) {
    console.error(`CodeFlow installation failed: ${error.message}`);
    process.exitCode = 1;
}
