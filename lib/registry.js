'use babel';

class Registry {
  constructor(serialized = []) {
    this.items = new Map(serialized);
  }

  set(items = {}) {
    this.items = new Map(items);
  }

  get(key) {
    return this.items.get(key);
  }

  add(key, value) {
    this.items.set(key, value);
  }

  find(prefix, keyTransform = (key => key)) {
    const matches = [];
    for (const [ key, value ] of this.items) {
      if (keyTransform(key).startsWith(prefix)) {
        matches.push(value);
      }
    }
    return matches;
  }

  serialize() {
    return [ ...this.items ];
  }

  _clear() {
    this.items.clear();
  }
}

export default Registry;
