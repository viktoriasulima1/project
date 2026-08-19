# Clerk Production Setup for Pilot

Create/activate a Clerk **production** instance; do not reuse development. Associate the stable pilot domain and deploy Clerk DNS/certificates. Configure `/sign-in`, `/sign-up`, after-sign-in `/dashboard`, after-sign-up `/onboarding` for new users (application farm state determines onboarding), and after-sign-out `/sign-in`. Allow only the stable origin and required callbacks.

Store `pk_live_` and `sk_live_` in hosting environment variables. Never expose or log the secret key. Verify email delivery and a dedicated pilot smoke account. Test anonymous redirects, return URL, refresh, Safari back/new-tab, expiry, PWA launch and sign-out on the physical iPhone.
