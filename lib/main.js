'use babel';

export default {

  BUSY_COLLECT_ID: 'java-classpath-registry.collect',
  BUSY_COLLECT_DESCRIPTION: 'Collecting Java Classes...',

  deactivate() {
    this.cache && this.cache.dispose();
  },

  collect() {
    const { collect } = require('./collector');

    this.registry._clear();
    this.busyRegistry && this.busyRegistry.begin(this.BUSY_COLLECT_ID, this.BUSY_COLLECT_DESCRIPTION);

    this.collectPromise = Promise.resolve()
      .then(() => {
        return collect(this.registry, this.cache);
      })
      .then(() => {
        this.collectPromise = null;
        this.busyRegistry && this.busyRegistry.end(this.BUSY_COLLECT_ID, true);
      })
      .catch(err => {
        this.collectPromise = null;
        atom.notifications.addError('Failed to collect java classes', {
          detail: err.message,
          stack: err.stack,
          dismissable: true
        });
        this.busyRegistry && this.busyRegistry.end(this.BUSY_COLLECT_ID, false);
      });
  },

  /**
   * Called when someone actually is interested in the classpath registry.
   * Initialize and do all work here. This reduced load times and doesn't do
   * any work if we might not need it.
   */
  provide() {
    require('atom-package-deps').install('java-classpath-registry');
    atom.commands.add('atom-workspace', 'java-classpath-registry:refresh', () => this.collect());

    if (!this.cache) {
      const Cache = require('./cache');
      this.cache = new Cache();
    }

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
