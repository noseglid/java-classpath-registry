'use babel';

import jdjs from 'jdjs';

function collect(entries) {
  return Promise.resolve(entries)
    .then(allFiles => Promise.all(allFiles.map(filename =>
      Promise.all([ filename, jdjs(filename) ])
        .catch(err => {
          console.warn('Failed to parse', filename, err.message);
          return [];
        })
    )))
    .then(result => {
      result.map(([ filename, descriptions ]) => {
        descriptions
          .filter(entry => entry.modifiers.includes('public'))
          .forEach(entry => {
            this.emit('entry', filename, entry);
          });
      });
    })
    .catch(err => {
      console.error('collector-task failed:', err.stack);
    });
}

module.exports = function (entries) {
  const callback = this.async();

  if (0 === entries.length) {
    return callback();
  }

  return collect(entries).then(() => {
    callback();
  });
};
