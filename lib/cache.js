'use babel';

import { promisify } from 'bluebird';
import { readFile, writeFile, mkdir, stat, unlink } from 'fs';
import glob from 'glob';

const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);
const mkdirAsync = promisify(mkdir);
const globAsync = promisify(glob);
const statAsync = promisify(stat);
const unlinkAsync = promisify(unlink);

class Cache {

  VERSION = 1;
  CACHEFOLDER = `${process.env.ATOM_HOME}/classpath-cache`;

  constructor() {
    this.items = new Map();
    this.housekeeper = setInterval(::this.clearExpiredCache, 1000 * 60 * 30); // Every 30 minutes
  }

  dispose() {
    clearInterval(this.housekeeper);
  }

  clearExpiredCache() {
    const now = new Date();
    return globAsync(`${this.CACHEFOLDER}/*.json`)
      .then(files => Promise.all(files.map(file => Promise.all([ file, statAsync(file) ]))))
      .then(result => Promise.all(result.map(([ file, fstat ]) => {
        const age = (now - fstat.atime) / 1000 / 60 / 60 / 24;
        if (age > atom.config.get('java-classpath-registry.cacheTtl')) {
          return unlinkAsync(file).then(() => fstat.size);
        }

        return false;
      })))
      .then(result => {
        const unlinked = result.filter(e => e !== false);
        const size = result.reduce((memo, s) => memo + s, 0);
        if (unlinked.length > 0) {
          console.log(`deleted ${unlinked.length} caches, freeing ${(size / (1024 * 1024)).toFixed(2)} MB`);
        }
      });
  }

  get(hash) {
    if (this.items.has(hash)) {
      return Promise.resolve(this.items.get(hash));
    }

    return readFileAsync(`${this.CACHEFOLDER}/${hash}.json`)
      .then(JSON.parse)
      .then(({ version, entries }) => {
        if (this.VERSION !== version) {
          console.warn('version mismatch, ignoring cache');
          return null;
        }

        this.set(hash, entries);
        return entries;
      })
      .catch(() => null);
  }

  set(hash, entries) {
    this.items.set(hash, entries);
  }

  addEntry(hash, entry) {
    const entries = this.items.get(hash) || [];
    entries.push(entry);
    this.items.set(hash, entries);
  }

  save() {
    return mkdirAsync(this.CACHEFOLDER)
      .catch(e => { /* folder already exists */ })
      .then(() => {
        return Promise.all([ ...this.items ].map(([ hash, entries ]) => {
          return writeFileAsync(`${this.CACHEFOLDER}/${hash}.json`, JSON.stringify({
            version: this.VERSION,
            entries: entries
          }));
        }));
      });
  }
}

export default Cache;