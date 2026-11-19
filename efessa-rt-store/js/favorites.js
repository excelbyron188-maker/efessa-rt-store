/* Favorites are kept in localStorage so a refresh does not clear them. */
(function () {
  const KEY = "efessa-favorites-v1";

  function read() {
    try {
      const ids = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(ids) ? ids : [];
    } catch {
      return [];
    }
  }

  function write(ids) {
    try {
      localStorage.setItem(KEY, JSON.stringify(ids));
    } catch {
      /* Storage can be blocked (for example in private browsing). */
    }

    window.dispatchEvent(
      new CustomEvent("efessa:favorites-updated")
    );
  }

  function has(id) {
    return read().includes(id);
  }

  function toggle(id) {
    const ids = read();
    const index = ids.indexOf(id);

    if (index >= 0) {
      ids.splice(index, 1);
    } else {
      ids.push(id);
    }

    write(ids);
    return index < 0;
  }

  window.EFESSA_FAVORITES = {
    read,
    has,
    toggle
  };
})();
