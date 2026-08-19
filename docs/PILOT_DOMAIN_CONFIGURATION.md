# Pilot Domain Configuration

Selected hostname: **TBD — not configured**. Choose one stable origin such as `pilot.<owned-domain>.nl` or a stable provider subdomain. Temporary tunnel domains are prohibited.

Set `NEXT_PUBLIC_APP_URL` and `PILOT_BASE_URL` to the exact HTTPS origin. Configure the provider-required CNAME/A records, wait for DNS propagation, provision a trusted certificate, and verify `/api/health`, `/sign-in`, `/manifest.webmanifest` and `/sw.js`.

Expected SSL: provider-managed TLS with automatic renewal. Enable HSTS only after the hostname and rollback destination are proven. Rollback destination: previous immutable deployment on the same hostname; never move users back to a tunnel or localhost.
