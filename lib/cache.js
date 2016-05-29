'use babel';

import { readFile, writeFile, mkdir } from 'fs';
import { promisify } from 'bluebird';

const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);
const mkdirAsync = promisify(mkdir);

class Cache {

  VERSION = 1;
  CACHEFOLDER = `${process.env.ATOM_HOME}/classpath`;

  constructor() {
    this.items = new Map();
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
