'use babel';

export default {

  BUSY_COLLECT_ID: 'java-classpath-registry.collect',
  BUSY_COLLECT_DESCRIPTION: 'Collecting Java Classes...',

  activate(state) {
  },

  deactivate() {
  },

  serialize() {
  },

  collect() {
    const { collect } = require('./collector');

    this.registry._clear();
    this.busyRegistry && this.busyRegistry.begin(this.BUSY_COLLECT_ID, this.BUSY_COLLECT_DESCRIPTION);
    this.collectPromise = collect(this.registry)
      .then(() => {
        this.collectPromise = null;
        this.busyRegistry && this.busyRegistry.end(this.BUSY_COLLECT_ID, true);
      })
      .catch(err => {
        atom.notifications.addError('Failed to collect java classes', {
          detail: err.stack,
          dismissable: true
        });
        this.busyRegistry && this.busyRegistry.end(this.BUSY_COLLECT_ID, false);
      });
  },

  provide() {
    require('atom-package-deps').install('java-classpath-registry');
    atom.commands.add('atom-workspace', 'java-classpath-registry:refresh', () => this.collect());
    if (!this.registry) {
      const Registry = require('./registry');
      this.registry = new Registry();
      this.collect();
    }
    return this.registry;
  },

  consumeBusy(registry) {
    this.busyRegistry = registry;
    if (this.collectPromise) {
      this.busyRegistry.begin(this.BUSY_COLLECT_ID, this.BUSY_COLLECT_DESCRIPTION);
    }
  }

};
