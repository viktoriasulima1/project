-- Run once, against the `postgres` maintenance database, to create the
-- isolated E2E database. Never run this against a database whose name you
-- haven't just chosen yourself for E2E use.
CREATE DATABASE farmos_e2e;
