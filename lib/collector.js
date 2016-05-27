'use babel';

import fs from 'fs';
import os from 'os';
import path from 'path';
import { exec } from 'child_process';
import { Task } from 'atom';
import bluebird from 'bluebird';
import glob from 'glob';

const readFileAsync = bluebird.promisify(fs.readFile);
const globAsync = bluebird.promisify(glob);

function implicitLibs() {
  return new Promise((resolve, reject) => {
    exec('java -verbose -help', (err, stdout, stderr) => { // Cannot promisify due to multiple args in callback
      // Output sample: `[Loaded java.lang.Shutdown from /Library/Java/JavaVirtualMachines/jdk1.8.0_92.jdk/Contents/Home/jre/lib/rt.jar]`
      const match = stdout.match(/\[Loaded (?:[^\s]+) from (.*)\/.*\.jar\]/);
      return (err || !match) ?
        reject(err || 'Failed to find implicit libs') :
        resolve(match[1]);
    });
  });
}

function trimEntries(entries) {
  return entries.map(entry => entry.trim());
}

function handleMissingClasspath(err) {
  if (err.code === 'ENOENT') {
    return [];
  }
  throw new Error(err);
}

function resolveEntries(entries) {
  return Promise.all(entries.map(entry => {
    if (entry.endsWith('.jar') || entry.endsWith('.class')) {
      return Promise.resolve([ entry ]);
    }

    return globAsync(`${entry}/**/*.*(class|jar)`);
  }));
}

function flattenEntries(entries) {
  return [].concat.apply([], entries);
}

function filterFalsyArray(entries) {
  return entries.filter(Boolean);
}

function readClassPath() {
  const paths = atom.project.getPaths();
  if (paths.length > 1) {
    return Promise.reject(new Error('Only one open project supported.'));
  } else if (paths.length === 0) {
    return Promise.resolve([]);
  }

  return Promise.all([ readFileAsync(`${paths[0]}/.classpath`), implicitLibs() ])
    .then(([ classpath, libs ]) => classpath.toString('utf8').split(path.delimiter).concat(libs))
    .catch(handleMissingClasspath)
    .then(filterFalsyArray)
    .then(trimEntries)
    .then(resolveEntries)
    .then(flattenEntries);
}

export const collect = (dictionary) => {
  return readClassPath().then(classpathEntries => new Promise((resolve, reject) => {
    const tasks = os.cpus().length - 1; // leave one cpu free for other tasks, such as rendering
    const chunk = Math.ceil(classpathEntries.length / tasks);

    let done = 0;
    const donefn = () => (++done === tasks) && resolve();

    for (let i = 0; i < tasks; ++i) {
      const entries = classpathEntries.slice(i * chunk, (i + 1) * chunk);
      const task = Task.once(require.resolve('./collector-task'), entries, donefn);
      task.on('entry', (entry) => dictionary.add(entry.name, entry));
    }
  }));
};
