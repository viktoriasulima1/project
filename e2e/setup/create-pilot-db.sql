-- Run once, against the `postgres` maintenance database, to create the
-- isolated pilot database. Mirrors e2e/setup/create-e2e-db.sql's pattern —
-- never run this against a database whose name you haven't chosen yourself
-- for pilot use.
CREATE DATABASE farmos_pilot;
