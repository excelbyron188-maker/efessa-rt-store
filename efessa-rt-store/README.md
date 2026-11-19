# EFESSA RT Store

EFESSA RT is a responsive fashion storefront built with HTML, CSS, vanilla JavaScript, Node.js/Express, and PostgreSQL. Products, delivery settings, and order requests are stored in PostgreSQL. **Online payments are intentionally disabled for now.** Customers can submit an order request; the store must contact them with official payment and delivery instructions. Do not describe an order as paid unless payment has been verified separately.

## Requirements

- Node.js 18 or newer
- A PostgreSQL database (Neon PostgreSQL works)

## Run locally

1. Open this project folder in VS Code.
2. Open a terminal in the project folder.
3. Install dependencies: `npm install`
4. Copy `.env.example` to a new file named `.env`.
5. Set `DATABASE_URL` to the **full PostgreSQL connection string** copied from your database provider. Do not use the example placeholder.
6. Set a strong, unique `ADMIN_PASSWORD` and a long random `ADMIN_SESSION_SECRET`. Keep `.env` private and never commit it to GitHub.
7. Start the site with `npm start`.
8. Open `http://localhost:3000`. Do not use Live Server for checkout testing; checkout uses the Express API.
9. Check `http://localhost:3000/api/health`; a successful response should show `"database":"connected"`.
10. Open `http://localhost:3000/pages/admin.html` to access the administrator portal.

The server creates its database tables automatically. It does not seed hardcoded sample products; add the catalogue through the administrator dashboard.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Full PostgreSQL connection string from Neon or another provider |
| `DATABASE_SSL` | Defaults to SSL enabled; keep enabled for hosted databases |
| `ADMIN_PASSWORD` | Private admin password |
| `ADMIN_SESSION_SECRET` | Random secret used to sign the admin session cookie |
| `STORE_STATE` | Optional default state for local delivery; editable in admin settings |
| `PORT` | Port supplied by the hosting provider or `3000` locally |
| `NODE_ENV` | Set to `production` on production hosting |

## Payment status

Flutterwave and all other online payment integrations are intentionally on hold. No payment API keys are required or used by this version. Checkout records an order request with a pending payment status and reserves the requested stock. The store must contact the customer to arrange payment and delivery. Staff should only mark payment as paid after independently confirming that payment was actually received.

## Deploy

Deploy as a Node.js web service, not a static-only site. Use `npm install` as the build command and `npm start` as the start command. Configure the required environment variables in the host's environment-variable settings. Use a managed PostgreSQL database and HTTPS in production.

## Current implementation notes

- Product prices, stock, and the final delivery fee are recalculated on the server.
- Admins can save individual delivery fees for different Nigerian states. A matching state-specific fee overrides the fallback local/national rates; the checkout summary adds the selected delivery fee to the product subtotal and displays the combined total. Past orders keep their saved delivery fee.
- Orders and products persist in PostgreSQL.
- Stock is deducted when an order request is created; cancelling an order in the admin portal restores stock.
- The admin portal uses a signed, HttpOnly, SameSite cookie and server-side authorization checks.
- Order lookup requires the order reference and checkout email address.
- Admins can add, edit, feature, hide/show, search, and delete products. Deleting a catalogue item does not erase the product snapshot stored inside existing orders.
- Online payments, transactional email, newsletter subscription, and automated shipping-label creation are not implemented. The contact form prepares a WhatsApp message for the customer to send; it does not silently submit a message in the background.

## Before launch

Test checkout and cancellation on a staging deployment. Check product images and descriptions, delivery fees, stock changes, order lookup, admin access, and mobile layouts. Review and complete the shipping, returns, privacy, and terms pages using your actual policies before launch. The privacy page remains a draft and needs review for applicable Nigerian data-protection requirements. Confirm the customer contact details and any social links before launch. A successful syntax check is not a substitute for full end-to-end testing.


## Catalogue and website image management

Products are managed from the administrator dashboard and are not automatically seeded from JavaScript. A new database starts with an empty product catalogue; add the products you want through the dashboard. The dashboard's Delete action permanently removes a product from the catalogue while existing order snapshots remain intact.

The Website images section lets an administrator replace the homepage hero image, homepage campaign image, and category images using JPG, PNG, or WebP uploads up to 2 MB each, or HTTPS image URLs. Uploaded image data and image settings are stored in PostgreSQL so they persist across restarts and redeployments. A single image-settings save can include multiple uploads.

## Admin product editing

The product form supports editing product details, category, price, stock, description, sizes, colours, image, and whether the product appears in the homepage featured-products section. The catalogue includes search, hide/show, and permanent deletion actions. Hidden products are excluded from the public catalogue.

## Known launch considerations

- No real browser automation or live Neon database test is included with this source package. Run the test plan locally and on a staging deployment before replacing the live site.
- Newsletter signup is still a demo and is not connected to an email provider.
- Review the legal/policy pages and complete any missing delivery, cancellation, return, refund, and privacy wording before accepting customer orders.


## State-by-state delivery fees

In the administrator dashboard, use **Individual state prices** to add a delivery price for each state (for example, Lagos or Delta). Add the state name and fee, then choose **Add / update state price**. Use **Edit** to load an existing state into the form or **Remove** to delete its custom fee. The store's fallback local and national prices remain available for any state without an individual price. Checkout lets customers choose a Nigerian state and updates the delivery line and total automatically; the server independently calculates and saves the final fee with the order.

The storefront also uses subtle scroll-reveal effects, staggered product/category entrances, and smoother hover/focus feedback. These respect the visitor's reduced-motion preference.

### State-specific delivery fees

Individual state delivery rates are saved to the PostgreSQL `store_settings.state_delivery_fees` JSONB column through the authenticated `/api/admin/delivery-rates` endpoint. The admin interface re-reads the database after saving to confirm persistence. Public settings responses are marked no-cache so checkout does not reuse stale delivery rates. Checkout displays the matching state rate, and the server independently calculates the final saved order total. Abuja/FCT aliases are treated as equivalent.

### Touch and mobile interactions

Interactive elements include touch press feedback, visible keyboard focus, tap highlights, and mobile-friendly section/product reveals. Motion respects the visitor's reduced-motion preference.

### Individual state delivery rates

State-specific delivery rates are stored in the dedicated PostgreSQL `state_delivery_rates` table. On startup, the server creates this table and migrates any legacy state rates from the previous settings JSON field. The admin dashboard writes and verifies the state-rate table in a transaction; fallback delivery settings are saved separately and cannot overwrite individual state rates. Checkout displays the matching state rate and the server independently recalculates the final delivery fee when an order request is submitted.

### Mobile navigation and responsive layout

The mobile navigation drawer is layered above its dimming backdrop, includes keyboard/touch close behaviour, and exposes its open state to assistive technology. Responsive refinements cover the homepage, product cards, checkout, forms, admin delivery-rate controls, and touch feedback. Test at narrow widths and on a real mobile device before publishing.

## Latest mobile and delivery reliability refinements

- Fixed an admin authentication race: the admin page no longer sends an automatic logout request on load. A delayed logout response could clear a newly issued login cookie and make the next delivery-rate save fail with an authentication error. The dashboard still starts with the sign-in screen visible, and the server continues to protect every admin API route.
- State-specific delivery fees are stored in the dedicated `state_delivery_rates` PostgreSQL table. Saving verifies each persisted state's key and exact numeric fee before committing. If saving fails, check the server log for the `State delivery rates save failed` message and confirm the hosting environment has the correct `DATABASE_URL`.
- Mobile navigation supports close-button, backdrop, link, Escape-key, and desktop-resize closing behaviour, with expanded touch targets and safe-area spacing.
- Responsive styles have been refined for small phones, product/category grids, checkout forms, admin state-rate controls, buttons, drawers, typography, and touch interactions. Reduced-motion preferences are respected.

### Recommended verification before deployment

1. Start the app using `npm install` then `npm start` with your existing `.env` file.
2. Sign in to `/pages/admin.html`, save an individual state rate, refresh the dashboard, and verify the rate remains.
3. Save fallback delivery prices and confirm individual rates remain unchanged.
4. Test checkout with a state that has a custom rate and a state that uses the fallback rate. Confirm the displayed total and submitted order total agree.
5. Test the mobile menu on a real phone or responsive browser mode, including the close button, outside/backdrop tap, Escape key on a keyboard, and navigation links.

This archive has been syntax-checked, but it has not been connected to your private Neon database or tested through a live browser checkout. Do not reset your database; use a backup of the project folder before replacing any files.

