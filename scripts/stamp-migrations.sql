-- ============================================================
-- Carimbo das migrations 0000-0004 como aplicadas
-- Gerado em 2026-08-29T01:35:47.301Z
-- O schema já existe no banco (criado por SQL manual).
-- Este script apenas sincroniza o registro contábil do drizzle.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS "drizzle";

CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
	"id" SERIAL PRIMARY KEY,
	"hash" text NOT NULL,
	"created_at" bigint
);

-- Migration 0000_baseline
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES ('4409e907290586aa3f72b33f5d5d6977b2ebc99e1550be4d2a63b81e1a43312b', 1785888642358);

-- Migration 0001_romantic_siren
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES ('31f94593d39fc1021eebc2190110d4ac240043015855d39b6daa08c22a159a9a', 1785979671155);

-- Migration 0002_preapproval
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES ('f4e2be3a91029f930d53e53c28158add6bf69caf79ee16d82783ecd42666ea7b', 1787435827814);

-- Migration 0003_wide_molten_man
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES ('7b303837e6b296a6becff48000df826def915eadc63c745a7e6f4d432e8382c1', 1787523424018);

-- Migration 0004_storage_backend
INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES ('e553c0d103b701e29aa7f964dd311c3d87963ba9fb8aed82e2b5200693fcf2ed', 1787764711694);
