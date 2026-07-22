/*
  Warnings:

  - The values [swiggy] on the enum `ReviewSource` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `swiggy_url` on the `restaurants` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ReviewSource_new" AS ENUM ('google', 'zomato', 'tripadvisor');
ALTER TABLE "reviews" ALTER COLUMN "source" TYPE "ReviewSource_new" USING ("source"::text::"ReviewSource_new");
ALTER TYPE "ReviewSource" RENAME TO "ReviewSource_old";
ALTER TYPE "ReviewSource_new" RENAME TO "ReviewSource";
DROP TYPE "ReviewSource_old";
COMMIT;

-- AlterTable
ALTER TABLE "restaurants" DROP COLUMN "swiggy_url";
