# The Contactly Course

> A complete, text-based walkthrough for shipping a production-grade SaaS app — Principal Engineer Level 7+ style, written for humans.

## How each lesson works

Every lesson in this course follows the same rhythm:

1. **Why** — what problem are we solving? Why does this matter for a *real* SaaS app, not a toy?
2. **The Principal Engineer lens** — how a senior person frames this decision. Trade-offs, not recipes.
3. **Build it** — exact code, with every line explained.
4. **Verify it** — how to know it works. (Run the test, click the button, check the logs.)
5. **Common traps** — the mistakes that will bite you at 2 AM if you skip them.
6. **Recap + what's next**.

If you read only the code blocks, you'll have a working app. If you read the prose, you'll have the *reasoning* — and that's the real course.

## Navigation

### [Introduction](./introduction/)

- [Welcome & philosophy](./introduction/01-welcome.md)
- [What we're building](./introduction/02-what-were-building.md)
- [Prerequisites & environment](./introduction/03-prerequisites.md)
- [How to get help](./introduction/04-how-to-get-help.md)
- [The Principal Engineer mindset](./introduction/05-principal-engineer-mindset.md)

### [Module 1 — Project Setup](./module-01-project-setup/)

- [1.1 SvelteKit project setup](./module-01-project-setup/1.1-sveltekit-project-setup.md)
- [1.2 Supabase local development](./module-01-project-setup/1.2-supabase-local-development.md)
- [1.3 Protected auth schema](./module-01-project-setup/1.3-protected-auth-schema.md)
- [1.4 Profiles table & RLS](./module-01-project-setup/1.4-profiles-table-rls.md)

### [Module 2 — Integrate SvelteKit & Supabase](./module-02-integrate-sveltekit-supabase/)

- [2.1 Server-side environment](./module-02-integrate-sveltekit-supabase/2.1-server-side-environment.md)
- [2.2 Install Supabase SDKs & generate types](./module-02-integrate-sveltekit-supabase/2.2-install-sdks-generate-types.md)
- [2.3 Server-side Supabase](./module-02-integrate-sveltekit-supabase/2.3-server-side-supabase.md)
- [2.4 Client-side Supabase](./module-02-integrate-sveltekit-supabase/2.4-client-side-supabase.md)

### [Module 3 — User Auth](./module-03-user-auth/)

- [3.1 User registration](./module-03-user-auth/3.1-user-registration.md)
- [3.2 User login](./module-03-user-auth/3.2-user-login.md)
- [3.3 Protecting auth routes](./module-03-user-auth/3.3-protecting-auth-routes.md)
- [3.4 User logout & navigation](./module-03-user-auth/3.4-user-logout-navigation.md)
- [3.5 Account page](./module-03-user-auth/3.5-account-page.md)
- [3.6 Account actions](./module-03-user-auth/3.6-account-actions.md)

### [Module 4 — CRUD (Create, Read, Update, Delete)](./module-04-crud/)

- [4.1 Contacts table & RLS policies](./module-04-crud/4.1-contacts-table-rls.md)
- [4.2 Seeding Supabase](./module-04-crud/4.2-seeding-supabase.md)
- [4.3 Creating contacts](./module-04-crud/4.3-creating-contacts.md)
- [4.4 Supabase admin client](./module-04-crud/4.4-supabase-admin-client.md)
- [4.5 Reading contacts](./module-04-crud/4.5-reading-contacts.md)
- [4.6 Updating contacts](./module-04-crud/4.6-updating-contacts.md)
- [4.7 Deleting contacts](./module-04-crud/4.7-deleting-contacts.md)
- [4.7.1 Close modal on cancel](./module-04-crud/4.7.1-close-modal-on-cancel.md)
- [4.8 Seeding contacts](./module-04-crud/4.8-seeding-contacts.md)

### [Module 5 — Stripe Introduction](./module-05-stripe-introduction/)

- [5.1 Stripe dashboard overview](./module-05-stripe-introduction/5.1-stripe-dashboard-overview.md)
- [5.2 Stripe API & docs](./module-05-stripe-introduction/5.2-stripe-api-and-docs.md)
- [5.3 Setup Stripe CLI](./module-05-stripe-introduction/5.3-setup-stripe-cli.md)
- [5.3.1 Stripe CLI WSL note](./module-05-stripe-introduction/5.3.1-stripe-cli-wsl.md)
- [5.4 Products & prices overview](./module-05-stripe-introduction/5.4-products-prices-overview.md)
- [5.5 Creating products & prices](./module-05-stripe-introduction/5.5-creating-products-prices.md)
- [5.6 Lookup keys](./module-05-stripe-introduction/5.6-lookup-keys.md)
- [5.7 Cleanup](./module-05-stripe-introduction/5.7-cleanup.md)

### [Module 6 — Stripe & SvelteKit Integration](./module-06-stripe-sveltekit-integration/)

- [6.1 Setup Stripe Node client](./module-06-stripe-sveltekit-integration/6.1-setup-stripe-node-client.md)
- [6.2 Stripe webhooks & events](./module-06-stripe-sveltekit-integration/6.2-stripe-webhooks-and-events.md)
- [6.3 Create webhook endpoint](./module-06-stripe-sveltekit-integration/6.3-create-webhook-endpoint.md)
- [6.3.1 Webhook script](./module-06-stripe-sveltekit-integration/6.3.1-webhook-script.md)
- [6.4 What data to store](./module-06-stripe-sveltekit-integration/6.4-what-data-to-store.md)

### [Module 7 — Billing Services](./module-07-billing-services/)

- [7.1 Define billing tables](./module-07-billing-services/7.1-define-billing-tables.md)
- [7.2 Products service](./module-07-billing-services/7.2-products-service.md)
- [7.3 Customers service](./module-07-billing-services/7.3-customers-service.md)
- [7.4 Subscriptions service](./module-07-billing-services/7.4-subscriptions-service.md)

### [Module 8 — Products, Pricing & Pricing Page](./module-08-products-pricing-page/)

- [8.1 Create products & prices](./module-08-products-pricing-page/8.1-create-products-prices.md)
- [8.2 Seeding Stripe data](./module-08-products-pricing-page/8.2-seeding-stripe-data.md)
- [8.3 Pricing page config](./module-08-products-pricing-page/8.3-pricing-page-config.md)
- [8.4 Pricing page](./module-08-products-pricing-page/8.4-pricing-page.md)

### [Module 9 — Pricing, Checkout & Billing](./module-09-pricing-checkout-billing/)

- [9.1 Checkout sessions](./module-09-pricing-checkout-billing/9.1-checkout-sessions.md)
- [9.2 Free trial options](./module-09-pricing-checkout-billing/9.2-free-trial-options.md)
- [9.3 Stripe test clocks](./module-09-pricing-checkout-billing/9.3-stripe-test-clocks.md)
- [9.4 Preventing multiple trials](./module-09-pricing-checkout-billing/9.4-preventing-multiple-trials.md)
- [9.5 Test cards & failed payments](./module-09-pricing-checkout-billing/9.5-test-cards-failed-payments.md)
- [9.6 Subscription & email settings](./module-09-pricing-checkout-billing/9.6-subscription-email-settings.md)
- [9.7 Configure Customer Portal](./module-09-pricing-checkout-billing/9.7-configure-customer-portal.md)
- [9.8 Deliver Customer Portal](./module-09-pricing-checkout-billing/9.8-deliver-customer-portal.md)

### [Module 10 — Tier-Based Access Control](./module-10-tier-based-access-control/)

- [10.1 Validate tier helpers](./module-10-tier-based-access-control/10.1-validate-tier-helpers.md)
- [10.2 Restricting actions](./module-10-tier-based-access-control/10.2-restricting-actions.md)
- [10.3 Limiting UI interactions](./module-10-tier-based-access-control/10.3-limiting-ui-interactions.md)
- [10.4 Prevent multiple plans](./module-10-tier-based-access-control/10.4-prevent-multiple-plans.md)

### [Module 11 — Testing](./module-11-testing/)

- [11.1 Setup Playwright](./module-11-testing/11.1-setup-playwright.md)
- [11.2 Auth flow tests](./module-11-testing/11.2-auth-flow-tests.md)
- [11.3 CRUD tests](./module-11-testing/11.3-crud-tests.md)

### [Module 12 — CI/CD Pipeline & Production](./module-12-cicd-production/)

- [12.1 CI/CD pipeline overview](./module-12-cicd-production/12.1-pipeline-overview.md)
- [12.2 Supabase to production](./module-12-cicd-production/12.2-supabase-to-production.md)
- [12.3 Creating Vercel project](./module-12-cicd-production/12.3-creating-vercel-project.md)
- [12.4 GitHub Actions workflow](./module-12-cicd-production/12.4-github-actions-workflow.md)
- [12.5 Stripe & Supabase in production](./module-12-cicd-production/12.5-stripe-supabase-production.md)
- [12.6 Production URL updates](./module-12-cicd-production/12.6-production-url-updates.md)

### [Module 13 — UX Extras](./module-13-ux-extras/)

- [13.1 Toast notifications](./module-13-ux-extras/13.1-toast-notifications.md)
- [13.2 Better redirects](./module-13-ux-extras/13.2-better-redirects.md)
- [13.3 Stripe branding](./module-13-ux-extras/13.3-stripe-branding.md)

### [Extras — Function Enhancements](./extras/)

Optional lessons, independent of one another. The centrepiece is a custom Simpler Trading-style cart and multi-step checkout built with Stripe Elements — spanning four lessons. The rest are focused enhancements to functions you already shipped.

- [E.1 Hosted Checkout vs Stripe Elements](./extras/E.1-hosted-vs-elements.md)
- [E.2 The cart store and cart sidebar component](./extras/E.2-cart-store-sidebar.md)
- [E.3 The three-step checkout stepper](./extras/E.3-checkout-stepper.md)
- [E.4 Embedded payment with Stripe Elements](./extras/E.4-stripe-elements-payment.md)
- [E.5 One flow, two trials — with and without a card](./extras/E.5-trial-with-without-card.md)
- [E.6 Optimistic UI for contacts](./extras/E.6-optimistic-ui.md)
- [E.7 CSV import for contacts](./extras/E.7-csv-import.md)
- [E.8 Keyboard shortcuts](./extras/E.8-keyboard-shortcuts.md)
- [E.9 Rate limiting sensitive endpoints](./extras/E.9-rate-limiting.md)
- [E.10 Contact avatars with Supabase Storage](./extras/E.10-avatars-supabase-storage.md)
- [E.11 Full-text contact search](./extras/E.11-fulltext-search.md)
- [E.12 Cursor pagination & infinite scroll](./extras/E.12-cursor-pagination.md)
- [E.13 Realtime contact sync](./extras/E.13-realtime-sync.md)
- [E.14 Audit log](./extras/E.14-audit-log.md)
- [E.15 Error tracking with Sentry](./extras/E.15-error-tracking-sentry.md)

### [Thank you](./thank-you.md)

## The Contactly spec

When you're done, you'll have shipped an app that:

- Lets anyone register and log in (email + password, Supabase Auth).
- Gives every user a profile, a Stripe customer record, and zero, one, or many subscriptions.
- Offers a public `/pricing` page with Monthly/Yearly toggle and three tiers: **Free**, **Plus** ($10/mo), **Pro** ($20/mo).
- Supports Stripe Customer Portal for self-service upgrades/downgrades/cancels.
- Supports **free trials with and without a payment method**, and blocks serial-trial abusers.
- Uses **Row-Level Security** so users can only see their own contacts — enforced at the database.
- Uses **tier-based access control** everywhere: server-side guards *and* disabled UI buttons with upgrade CTAs.
- Has **end-to-end Playwright tests** that run in CI against a local Supabase.
- Deploys via **GitHub Actions → Vercel** with Supabase DB migrations pushed as part of the pipeline.
- Is built almost entirely with **SvelteKit remote functions** (`query`, `form`, `command`) — the April 2026 hot pattern.

Let's go.
