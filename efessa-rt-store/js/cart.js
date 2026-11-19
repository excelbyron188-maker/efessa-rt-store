/* Browser-based demonstration shopping cart.

   IMPORTANT: this cart lives in the customer's browser, so anyone can change
   it with the browser's developer tools. The limits below (stock, whole
   numbers) are only for a smooth shopping experience. When the real server is
   built, it will re-check every price, size, colour and quantity at checkout. */
(function () {
  const KEY = "efessa-cart-v1";

  function read() {
    try {
      const items = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  }

  function write(items) {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* Storage can be blocked (for example in private browsing). */
    }

    window.dispatchEvent(
      new CustomEvent("efessa:cart-updated")
    );
  }

  // How many of this product exist (the whole product, across all sizes).
  function stockFor(product) {
    const known = window.EFESSA_DATA?.products?.find(
      item => item.id === product.id
    );
    const stock = Number((known || product).stock);
    return Number.isFinite(stock) ? stock : Infinity;
  }

  function quantityInBag(items, id, exceptIndex = -1) {
    return items.reduce((sum, item, index) =>
      item.id === id && index !== exceptIndex
        ? sum + Number(item.quantity || 0)
        : sum, 0);
  }

  /* Returns { added, limited, stock }:
     added   = how many were really added to the bag
     limited = true when fewer than requested were added because of stock */
  function add(product, options = {}) {
    const items = read();

    const size = options.size || "";
    const color = options.color || "";

    let wanted = Math.floor(Number(options.quantity));
    if (!Number.isFinite(wanted) || wanted < 1) wanted = 1;

    const stock = stockFor(product);
    const room = Math.max(0, stock - quantityInBag(items, product.id));
    const added = Math.min(wanted, room);

    if (added < 1) {
      return { added: 0, limited: true, stock };
    }

    const existing = items.find(item =>
      item.id === product.id &&
      item.size === size &&
      item.color === color
    );

    if (existing) {
      existing.quantity = Number(existing.quantity || 0) + added;
    } else {
      items.push({
        id: product.id,
        name: product.name,
        image: product.image,
        price: Number(product.price),
        size,
        color,
        quantity: added
      });
    }

    write(items);
    return { added, limited: added < wanted, stock };
  }

  function remove(index) {
    const items = read();

    if (index >= 0 && index < items.length) {
      items.splice(index, 1);
      write(items);
    }
  }

  function updateQuantity(index, quantity) {
    const items = read();
    const item = items[index];

    if (!item) return;

    const amount = Number(quantity);

    if (!Number.isFinite(amount) || amount < 1) {
      items.splice(index, 1);
    } else {
      const room = Math.max(
        1,
        stockFor(item) - quantityInBag(items, item.id, index)
      );
      item.quantity = Math.min(Math.floor(amount), room);
    }

    write(items);
  }

  function clear() {
    write([]);
  }

  function count() {
    return read().reduce(
      (total, item) => total + Number(item.quantity || 0),
      0
    );
  }

  function total() {
    return read().reduce(
      (sum, item) =>
        sum + Number(item.price) * Number(item.quantity),
      0
    );
  }

  window.EFESSA_CART = {
    read,
    add,
    remove,
    updateQuantity,
    clear,
    count,
    total
  };
})();
