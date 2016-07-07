'use babel';

import { createReadStream, readFile } from 'fs';
import { createHash } from 'crypto';
import { cpus } from 'os';
import { delimiter } from 'path';
import { exec } from 'child_process';
import { Task } from 'atom';
import bluebird from 'bluebird';
import glob from 'glob';

const readFileAsync = bluebird.promisify(readFile);
const globAsync = bluebird.promisify(glob);

function hashFileContent(filename) {
  const hash = createHash('md5');
  const fileStream = createReadStream(filename);

  hash.setEncoding('hex');
  fileStream.pipe(hash);

  return new Promise((resolve, reject) => {
    fileStream.on('end', () => resolve(hash.read()));
    fileStream.on('error', reject);
    hash.on('error', reject);
  });
}

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

function trimFilenames(filenames) {
  return filenames.map(filename => filename.trim());
}

function handleMissingClasspath(err) {
  if (err.code === 'ENOENT') {
    return [];
  }
  throw err;
}

function resolveFilenames(filenames) {
  return Promise.all(filenames.map(filename => {
    if (filename.endsWith('.jar') || filename.endsWith('.class')) {
      return Promise.resolve([ filename ]);
    }

    return globAsync(`${filename}/**/*.*(class|jar)`);
  }));
}

function flattenFilenames(filenames) {
  return [].concat.apply([], filenames);
}

function filterFalsyArray(entries) {
  return entries.filter(Boolean);
}

function hashFilenamesContent(filenames) {
  return Promise.all(filenames.map(filename =>
    Promise.all([ filename, hashFileContent(filename) ])
  ));
}

function readClassPath() {
  const paths = atom.project.getPaths();
  if (paths.length > 1) {
    return Promise.reject(new Error('Only one open project supported.'));
  } else if (paths.length === 0) {
    return Promise.resolve([]);
  }

  return Promise.all([ readFileAsync(`${paths[0]}/${atom.config.get('java-classpath-registry.classpathFile')}`),
      implicitLibs() ])
    .then(([ classpath, libs ]) => classpath.toString('utf8').split(delimiter).concat(libs))
    .catch(handleMissingClasspath)
    .then(filterFalsyArray)
    .then(trimFilenames)
    .then(resolveFilenames)
    .then(flattenFilenames)
    .then(hashFilenamesContent);
}

function getClasspathEntriesFromCache(cache) {
  return classpathEntries => {
    return Promise.all(classpathEntries.map(([ filename, hash ]) => {
      return Promise.all([ filename, hash, cache.get(hash) ]);
    }));
  };
}

function registerAndFilterCachedClasspathEntries(registry) {
  return classpathEntries => {
    return classpathEntries.filter(([ filename, hash, cachedEntries ]) => {
      if (cachedEntries) {
        cachedEntries.forEach(entry => registry.add(entry.name, entry));
        return false;
      }

      return true;
    });
  };
}

function parseClasspathEntries(registry, cache) {
  return classpathEntries => new Promise((resolve, reject) => {
    console.log(`will parse ${classpathEntries.length} classpath entries`);
    const tasks = cpus().length - 1; // leave one cpu free for other tasks, such as rendering

    const chunk = Math.ceil(classpathEntries.length / tasks);

    let done = 0;
    const donefn = () => (++done === tasks) && resolve();

    for (let i = 0; i < tasks; ++i) {
      const taskEntries = classpathEntries.slice(i * chunk, (i + 1) * chunk);
      taskEntries.forEach(([ , hash ]) => cache.set(hash, []));

      const entries = taskEntries.map(([ filename ]) => filename);
      const task = Task.once(require.resolve('./collector-task'), entries, donefn);
      task.on('entry', (filename, entry) => {
        const [ , hash ] = taskEntries.find(([ fname ]) => fname === filename);
        cache.addEntry(hash, entry);
        registry.add(entry.name, entry);
      });
    }
  });
}

function saveCache(cache) {
  return () => cache.save();
}

export const collect = (registry, cache) => {
  return readClassPath()
    .then(getClasspathEntriesFromCache(cache))
    .then(registerAndFilterCachedClasspathEntries(registry))
    .then(parseClasspathEntries(registry, cache))
    .then(saveCache(cache));
};
