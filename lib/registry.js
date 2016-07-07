'use babel';

class Registry {
  constructor() {
    this.items = new Map();
  }

  set(items = {}) {
    this.items = new Map(items);
  }

  get(key) {
    return this._getItemsMap(key).get(key);
  }

  add(key, value) {
    this._getItemsMap(key).set(key, value);
  }

  /**
   * Searches for the name of a class. E.g. `String` in `java.lang.String`.
   * The prefix must be the beginning of the class name.
   * Since there can be "very many classes" we must limit the search options
   * for snappy retrieval.
   */
  search(prefix) {
    const rootMap = this._getItemsMap(prefix);
    return this._getAllClasses(rootMap);
  }

  _clear() {
    this.items.clear();
  }

  _getAllClasses(map) {
    const classes = [];
    for (const [ key, value ] of map) {
      if ('-' === key.charAt(0)) {
        Array.prototype.push.apply(classes, this._getAllClasses(value));
      } else {
        classes.push(value);
      }
    }
    return classes;
  }

  /**
   * The index under which nested maps are stored.
   * It uses characters (dash) illegal in Java class names
   * thus guaranteeing no collisions
   */
  _mapIndex(k) {
    return `-${k}`;
  }

  _getItemsMap(key, subindex = null, items = null) {
    if (!items) {
      // Initializer. Set to the root items map
      subindex = key.substr(key.lastIndexOf('.') + 1); // Get `Class` out of `tld.vendor.Class`
      items = this.items;
    }

    if (0 === subindex.length) {
      return items;
    }

    const k = subindex[0];
    let nextItems = items.get(this._mapIndex(k));
    if (!nextItems) {
      nextItems = new Map();
      items.set(this._mapIndex(k), nextItems);
    }

    return this._getItemsMap(key, subindex.slice(1), nextItems);
  }
}

export default Registry;
