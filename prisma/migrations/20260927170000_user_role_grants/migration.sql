-- Kullanıcı başına birden fazla rol ve rol başına erişim düzeyi
ALTER TABLE "User" ADD COLUMN "roleGrants" JSONB;
