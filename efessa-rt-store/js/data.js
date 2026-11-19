/* Central editable content for EFESSA RT. */

window.EFESSA_DATA = {
  brand: {
    name: "EFESSA RT",
    tagline: "Dress like the occasion is yours.",
    description:
      "A glamorous destination for statement outfits, chic essentials and finishing touches."
  },

  currency: "₦",

  categories: [
    {
      id: "tops",
      name: "Chic tops",
      description: "The little pieces that change the whole look.",
      image:
        "https://images.unsplash.com/photo-1551163943-3f6a855d1153?auto=format&fit=crop&w=900&q=82",
      href: "pages/shop.html?category=tops"
    },
    {
      id: "jeans",
      name: "Denim, always",
      description: "Your favourite fit, from day plans to late nights.",
      image:
        "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=900&q=82",
      href: "pages/shop.html?category=jeans"
    },
    {
      id: "dresses",
      name: "The dresses",
      description: "One piece. A whole entrance.",
      image:
        "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=900&q=82",
      href: "pages/shop.html?category=dresses"
    },
    {
      id: "heels",
      name: "The heels",
      description: "A little height. A lot of presence.",
      image:
        "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=900&q=82",
      href: "pages/shop.html?category=heels"
    },
    {
      id: "bags",
      name: "It bags",
      description: "The finishing touch your look was waiting for.",
      image:
        "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=82",
      href: "pages/shop.html?category=bags"
    }
  ],

  products: [],

  benefits: [
    {
      icon: "✳",
      title: "Style, considered",
      text: "Pieces chosen to make getting dressed feel exciting."
    },
    {
      icon: "♡",
      title: "Secure checkout",
      text: "A clear, careful path from bag to order."
    },
    {
      icon: "✦",
      title: "Quality first",
      text: "We want the piece you receive to feel worth it."
    },
    {
      icon: "☏",
      title: "Here to help",
      text: "Support for sizing, orders and delivery questions."
    }
  ],

  footer: {
    about:
      "Statement outfits and finishing touches for women who dress with intention.",
    email: "efessartbrand@gmail.com",
    phone: "+234 906 348 8903",
    instagram: "#",
    tiktok: "#"
  }
};
// When served by the Node/Express app, load the live database catalogue before
// product grids render. Static preview remains usable if the API is unavailable.
window.EFESSA_DATA_READY = typeof window.fetch === "function"
  ? window.fetch("/api/products", { credentials: "same-origin" })
      .then(response => response.ok ? response.json() : null)
      .then(result => {
        if (result && result.success && Array.isArray(result.products)) {
          window.EFESSA_DATA.products = result.products;
        }
      })
      .catch(() => {})
  : Promise.resolve();
