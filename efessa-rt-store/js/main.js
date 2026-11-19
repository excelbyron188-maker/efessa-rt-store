(function () {
  "use strict";

  const data = window.EFESSA_DATA;
  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const onPage = location.pathname.includes("/pages/");
  const pageLink = file =>
    onPage ? file : `pages/${file}`;

  const money = value =>
    `${data.currency}${Number(value || 0).toLocaleString("en-NG")}`;

  // Makes text safe to place inside HTML so it can never run as code.
  // Use esc(...) around ANY text that came from data, storage or a customer.
  const esc = value =>
    String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character]));

  function icon(name) {
    const icons = {
      user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.5-3.2 3.1-5 7-5s6.5 1.8 7 5"/>',
      bag: '<path d="M5 8h14l1 12H4L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
      menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
      heart: '<path d="M20.8 8.7c0 5-8.8 10.1-8.8 10.1S3.2 13.7 3.2 8.7A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.6Z"/>'
    };

    return `<svg viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="1.6"
      stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">${icons[name] || ""}</svg>`;
  }

  function header() {
    const links = [
      ["Home", onPage ? "../index.html" : "index.html"],
      ["Shop", pageLink("shop.html")],
      ["Contact Us", pageLink("contact.html")],
      ["FAQ", pageLink("faq.html")],
      ["Our Story", pageLink("about.html")]
    ];

    const nav = links.map(([label, href]) =>
      `<a href="${href}">${label}</a>`
    ).join("");

    const home = onPage ? "../index.html" : "index.html";

    $("#site-header").innerHTML = `
      <header class="site-header" id="site-header-main">
        <div class="container header-inner">

          <a class="brand" href="${home}">
            <span class="brand-mark">E</span>
            <span class="brand-name">
              EFESSA RT
              <small>THE OCCASION EDIT</small>
            </span>
          </a>

          <nav class="main-nav" aria-label="Main navigation">
            ${nav}
          </nav>

          <div class="header-actions">
            <a class="icon-button"
              href="${pageLink("account.html")}"
              aria-label="Your account">
              ${icon("user")}
            </a>

            <button class="icon-button" id="cart-open"
              aria-label="Open shopping bag">
              ${icon("bag")}
              <span class="count-badge" id="cart-count">0</span>
            </button>

            <button class="icon-button menu-toggle" id="menu-open"
              aria-label="Open navigation menu">
              ${icon("menu")}
            </button>
          </div>
        </div>
      </header>

      <div class="cart-drawer-backdrop" id="cart-backdrop"></div>

      <aside class="cart-drawer" id="cart-drawer"
        aria-label="Shopping bag" aria-hidden="true">

        <div class="drawer-head">
          <h2>Your bag</h2>
          <button class="drawer-close" id="cart-close"
            aria-label="Close shopping bag">×</button>
        </div>

        <div class="drawer-items" id="drawer-items"></div>

        <div class="drawer-foot">
          <div class="drawer-total">
            <span>Product subtotal</span>
            <span id="drawer-total">₦0</span>
          </div>
          <p class="drawer-delivery-note">Delivery is calculated at checkout when you choose your state.</p>
          <a class="button button-primary"
            href="${pageLink("checkout.html")}">
            Continue to checkout <span class="arrow">↗</span>
          </a>
        </div>
      </aside>

      <div class="cart-drawer-backdrop mobile-backdrop"
        id="mobile-backdrop"></div>

      <nav class="mobile-menu" id="mobile-menu"
        aria-label="Mobile navigation">

        <div class="mobile-menu-head">
          <a class="brand" href="${home}">
            <span class="brand-mark">E</span>
            <span class="brand-name">
              EFESSA RT
              <small>THE OCCASION EDIT</small>
            </span>
          </a>
          <button class="drawer-close" id="menu-close"
            aria-label="Close menu">×</button>
        </div>

        ${nav}
        <a href="${pageLink("favorites.html")}">Saved favourites</a>
        <a href="${pageLink("orders.html")}">Track an order</a>
      </nav>
    `;

    const currentPath = location.pathname.endsWith('/') ? `${location.pathname}index.html` : location.pathname;
    document.querySelectorAll('.main-nav a, .mobile-menu a').forEach(link => {
      try {
        const target = new URL(link.href, location.href).pathname;
        if (target === currentPath || (currentPath.endsWith('/index.html') && target.endsWith('/index.html'))) {
          link.classList.add('active');
          link.setAttribute('aria-current', 'page');
        }
      } catch { /* Leave malformed links visibly unchanged for easier diagnosis. */ }
    });
    bindHeader();
    updateCartUI();
  }

  function bindHeader() {
    const menu = $("#mobile-menu");
    const mobileBackdrop = $("#mobile-backdrop");
    const drawer = $("#cart-drawer");
    const cartBackdrop = $("#cart-backdrop");

    const menuOpenButton = $("#menu-open");
    const menuCloseButton = $("#menu-close");
    function closeMenu() {
      menu.classList.remove("is-open");
      mobileBackdrop.classList.remove("is-open");
      document.body.classList.remove("menu-open");
      menu.setAttribute("aria-hidden", "true");
      menuOpenButton?.setAttribute("aria-expanded", "false");
    }

    function openMenu() {
      closeCart();
      menu.classList.add("is-open");
      mobileBackdrop.classList.add("is-open");
      document.body.classList.add("menu-open");
      menu.setAttribute("aria-hidden", "false");
      menuOpenButton?.setAttribute("aria-expanded", "true");
      menuCloseButton?.focus({ preventScroll: true });
    }

    menu.setAttribute("aria-hidden", "true");
    menuOpenButton?.setAttribute("aria-expanded", "false");
    menuOpenButton?.addEventListener("click", openMenu);
    menuCloseButton?.addEventListener("click", closeMenu);
    mobileBackdrop?.addEventListener("click", closeMenu);
    menu?.querySelectorAll("a").forEach(link => link.addEventListener("click", closeMenu));
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        if (menu.classList.contains("is-open")) {
          closeMenu();
          menuOpenButton?.focus({ preventScroll: true });
        }
        if (drawer.classList.contains("is-open")) closeCart();
      }
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 800 && menu.classList.contains("is-open")) closeMenu();
    }, { passive: true });

    function closeCart() {
      drawer.classList.remove("is-open");
      cartBackdrop.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");
    }

    $("#cart-open")?.addEventListener("click", () => {
      drawer.classList.add("is-open");
      cartBackdrop.classList.add("is-open");
      drawer.setAttribute("aria-hidden", "false");
      renderDrawer();
    });

    $("#cart-close")?.addEventListener("click", closeCart);
    cartBackdrop?.addEventListener("click", closeCart);

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeMenu();
        closeCart();
      }
    });

    window.addEventListener("scroll", () => {
      $("#site-header-main")?.classList.toggle(
        "is-sticky",
        window.scrollY > 24
      );
    }, { passive: true });
  }

  function updateCartUI() {
    const count = $("#cart-count");

    if (count && window.EFESSA_CART) {
      count.textContent = window.EFESSA_CART.count();
    }

    renderDrawer();
  }

  function renderDrawer() {
    const target = $("#drawer-items");

    if (!target || !window.EFESSA_CART) return;

    const items = window.EFESSA_CART.read();

    if (!items.length) {
      target.innerHTML = `
        <div class="empty-state">
          <h3>Your bag is taking a breather.</h3>
          <p>Add a piece you love and it will appear here.</p>
          <a class="button button-primary"
            href="${pageLink("shop.html")}">Explore the shop</a>
        </div>
      `;
    } else {
      target.innerHTML = items.map((item, index) => `
        <div class="drawer-item">
          <img src="${esc(item.image)}" alt="">
          <div>
            <h3>${esc(item.name)}</h3>
            <p>
              ${item.size ? `Size: ${esc(item.size)}<br>` : ""}
              ${item.color ? `Colour: ${esc(item.color)}<br>` : ""}
              Qty: ${esc(item.quantity)}
            </p>
            <strong>${money(item.price * item.quantity)}</strong>
          </div>
          <button type="button" data-remove-cart="${index}"
            aria-label="Remove item">×</button>
        </div>
      `).join("");
    }

    const total = $("#drawer-total");

    if (total) total.textContent = money(window.EFESSA_CART.total());

    target.querySelectorAll("[data-remove-cart]").forEach(button => {
      button.addEventListener("click", () => {
        window.EFESSA_CART.remove(Number(button.dataset.removeCart));
        updateCartUI();
      });
    });
  }

  function productCard(product) {
    const favourite = window.EFESSA_FAVORITES?.has(product.id);

    return `
      <article class="product-card reveal"
        data-product-card="${esc(product.id)}" tabindex="0">

        ${product.badge
          ? `<span class="product-badge">${esc(product.badge)}</span>`
          : ""}

        <button class="favorite-button ${favourite ? "is-favorite" : ""}"
          type="button" data-favorite="${esc(product.id)}"
          aria-pressed="${favourite ? "true" : "false"}"
          aria-label="Save ${esc(product.name)} to favourites">
          ${icon("heart")}
        </button>

        <div class="product-image-wrap">
          <img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy">
        </div>

        <div class="product-card-info">
          <p class="product-category">${esc(product.category)}</p>
          <h3 class="product-name">${esc(product.name)}</h3>

          <p class="product-price">
            ${money(product.price)}
            ${product.oldPrice
              ? `<del>${money(product.oldPrice)}</del>`
              : ""}
          </p>

          <div class="product-actions">
            <button class="product-add" type="button"
              data-add-product="${esc(product.id)}">
              Add to bag +
            </button>
            <span aria-hidden="true">↗</span>
          </div>
        </div>
      </article>
    `;
  }

  function renderCategories() {
    const target = $("#category-grid");
    if (!target) return;

    target.innerHTML = data.categories.map(category => `
      <a class="category-card reveal" href="${esc(category.href)}">
        <img class="category-photo" src="${esc(category.image)}"
          alt="${esc(category.name)}" loading="lazy">
        <div class="category-copy">
          <h3>${esc(category.name)}</h3>
          <p>${esc(category.description)}</p>
          <span class="category-cta">Explore edit ↗</span>
        </div>
      </a>
    `).join("");
  }

  function renderProducts(target, products) {
    if (!target) return;

    target.innerHTML = products.length
      ? products.map(productCard).join("")
      : `<div class="empty-state">
           <h3>No pieces found</h3>
           <p>Try another filter or browse the full collection.</p>
         </div>`;

    bindProductCards(target);
    revealSetup();
  }

  function bindProductCards(root = document) {
    function openProduct(card) {
      const prefix = onPage ? "" : "pages/";
      location.href = `${prefix}product.html?id=${
        encodeURIComponent(card.dataset.productCard)
      }`;
    }

    root.querySelectorAll("[data-product-card]").forEach(card => {
      card.addEventListener("click", event => {
        if (event.target.closest("button")) return;
        openProduct(card);
      });

      // Keyboard users: Enter or Space on a focused card opens the product.
      card.addEventListener("keydown", event => {
        if (event.target !== card) return;

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openProduct(card);
        }
      });
    });

    root.querySelectorAll("[data-favorite]").forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();

        const active = window.EFESSA_FAVORITES.toggle(
          button.dataset.favorite
        );

        button.classList.toggle("is-favorite", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");

        toast(active
          ? "Saved to your favourites."
          : "Removed from your favourites.");
      });
    });

    root.querySelectorAll("[data-add-product]").forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();

        const product = data.products.find(
          item => item.id === button.dataset.addProduct
        );

        if (!product) return;

        // The quick-add button picks the first size and colour.
        // The message below tells the customer which ones were chosen.
        const size = product.sizes?.[0] || "";
        const color = product.colors?.[0] || "";

        const result = window.EFESSA_CART.add(product, {
          size,
          color,
          quantity: 1
        });

        updateCartUI();

        if (!result.added) {
          toast(`You already have all available ${product.name} in your bag.`);
          return;
        }

        const chosen = [size && `size ${size}`, color && color.toLowerCase()]
          .filter(Boolean)
          .join(", ");

        toast(`${product.name} added to your bag${chosen ? ` (${chosen})` : ""}.`);
      });
    });
  }

  function renderBenefits() {
    const target = $("#benefits-grid");
    if (!target) return;

    target.innerHTML = data.benefits.map(item => `
      <div class="benefit-item">
        <span class="benefit-icon">${item.icon}</span>
        <div>
          <strong>${item.title}</strong>
          <p>${item.text}</p>
        </div>
      </div>
    `).join("");
  }

  function footer() {
    const path = pageLink("");

    $("#site-footer").innerHTML = `
      <footer class="site-footer">
        <div class="container">

          <div class="footer-grid">

            <div class="footer-brand">
              <a class="brand" href="${onPage ? "../index.html" : "index.html"}">
                <span class="brand-mark">E</span>
                <span class="brand-name">
                  EFESSA RT
                  <small>THE OCCASION EDIT</small>
                </span>
              </a>
              <p>${data.footer.about}</p>
            </div>

            <div class="footer-column">
              <h3>The shop</h3>
              <a href="${path}shop.html">Shop all</a>
              <a href="${path}shop.html?category=tops">Tops</a>
              <a href="${path}shop.html?category=jeans">Jeans</a>
              <a href="${path}shop.html?category=dresses">Dresses</a>
              <a href="${path}shop.html?category=heels">Heels</a>
              <a href="${path}shop.html?category=bags">Bags</a>
            </div>

            <div class="footer-column">
              <h3>The brand</h3>
              <a href="${path}about.html">Our story</a>
              <a href="${path}contact.html">Contact us</a>
              <a href="${path}faq.html">FAQs</a>
              <a href="${path}shipping.html">Shipping & returns</a>
              <a href="${path}privacy.html">Privacy policy</a>
              <a href="${path}terms.html">Terms</a>
            </div>

            <div class="footer-column">
              <h3>Need a hand?</h3>
              <p><a href="mailto:${esc(data.footer.email)}">${esc(data.footer.email)}</a></p>
              <p><a href="tel:+2349063488903">${esc(data.footer.phone)}</a></p>
            </div>

          </div>

          <div class="footer-bottom">
            <span>© ${new Date().getFullYear()} EFESSA RT.</span>
            <span>Made for the moments that matter.</span>
            <a class="footer-admin-link" href="${path}admin.html" aria-label="Administrator login">Admin login</a>
          </div>

        </div>
      </footer>

      <a class="customer-support-float"
        href="https://wa.me/2349063488903?text=Hello%20EFESSA%20RT%2C%20I%20need%20customer%20support."
        target="_blank" rel="noopener noreferrer"
        aria-label="Chat with EFESSA RT customer support on WhatsApp"
        title="Chat with us">
        <span class="customer-support-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.2 11.6a8.2 8.2 0 0 1-12.1 7.2L3 20l1.3-4.8a8.2 8.2 0 1 1 15.9-3.6Z"/><path d="M8.2 8.1c.3-.6.6-.6 1-.6h.3c.2 0 .4.1.5.4l.8 1.8c.1.2.1.4-.1.6l-.6.7c-.2.2-.2.4 0 .7.5.9 1.2 1.6 2.1 2.1.2.1.5.1.7-.1l.7-.8c.2-.2.4-.2.6-.1l1.7.8c.3.1.4.3.4.5 0 .5-.2 1-.6 1.3-.5.5-1.2.7-2 .6-1.1-.2-2.5-.9-3.7-2.1-1.2-1.2-2-2.6-2.1-3.7-.1-.8.2-1.5.6-2Z"/></svg></span>
      </a>
    `;
  }

  function toast(message) {
    const region = $("#toast-region");
    if (!region) return;

    const element = document.createElement("div");
    element.className = "toast-message";
    element.textContent = message;

    region.appendChild(element);

    setTimeout(() => element.remove(), 3500);
  }

  function revealSetup() {
    const nodes = document.querySelectorAll(
      ".reveal:not([data-reveal-ready])"
    );

    if (!("IntersectionObserver" in window)) {
      nodes.forEach(node => node.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });

    nodes.forEach(node => {
      node.dataset.revealReady = "1";
      observer.observe(node);
    });
  }

  async function boot() {
    if (window.EFESSA_DATA_READY) await window.EFESSA_DATA_READY;
    // Image settings can contain persistent uploaded image data. Fetch them only on
    // the homepage, where hero, campaign, and category images are actually rendered.
    if (document.querySelector('#site-hero-image, #site-campaign-image, #category-grid')) {
      try {
        const response = await fetch('/api/settings/public', { credentials: 'same-origin' });
        const payload = response.ok ? await response.json() : null;
        const settings = payload?.success ? payload.settings : null;
        if (settings) {
          const heroImage = document.querySelector('#site-hero-image');
          const campaignImage = document.querySelector('#site-campaign-image');
          if (heroImage && settings.heroImage) heroImage.src = settings.heroImage;
          if (campaignImage && settings.campaignImage) campaignImage.src = settings.campaignImage;
          if (settings.categoryImages) {
            data.categories.forEach(category => {
              if (settings.categoryImages[category.id]) category.image = settings.categoryImages[category.id];
            });
          }
        }
      } catch (error) { /* Default editorial images remain as a graceful fallback. */ }
    }
    header();
    footer();
    renderCategories();
    renderBenefits();

    renderProducts(
      $("#featured-grid"),
      data.products.filter(product => product.featured).slice(0, 4)
    );

    revealSetup();

    // The newsletter is not connected to an email service yet, so we say so
    // honestly instead of pretending the person was subscribed.
    $("#newsletter-form")?.addEventListener("submit", event => {
      event.preventDefault();
      event.target.reset();
      toast("Newsletter sign-up isn't connected yet. This is a demo form.");
    });

    window.addEventListener("efessa:cart-updated", updateCartUI);
    window.addEventListener("efessa:favorites-updated", () => {
      document.querySelectorAll("[data-favorite]").forEach(button => {
        const saved = window.EFESSA_FAVORITES.has(button.dataset.favorite);
        button.classList.toggle("is-favorite", saved);
        button.setAttribute("aria-pressed", saved ? "true" : "false");
      });
    });
  }

  window.EFESSA_APP = {
    money,
    esc,
    icon,
    toast,
    renderProducts,
    productCard,
    bindProductCards,
    updateCartUI,
    revealSetup
  };

  function polishMotion() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const targets = document.querySelectorAll(
      ".page-top .container, main > .section, .section-heading, .category-card, .product-card, .info-card, .checkout-summary, .campaign-content, .benefit-card, .faq-item, .contact-card, .footer-grid > *, .newsletter-inner"
    );
    targets.forEach((node, index) => {
      if (!node.classList.contains("reveal")) node.classList.add("reveal");
      if (node.matches(".product-card, .category-card")) node.style.transitionDelay = `${Math.min(index % 4, 3) * 55}ms`;
    });
    revealSetup();
  }

  document.addEventListener("DOMContentLoaded", () => {
    boot();
    polishMotion();
  });
})();