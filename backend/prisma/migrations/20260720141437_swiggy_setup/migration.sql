-- AlterEnum
ALTER TYPE "ReviewSource" ADD VALUE 'swiggy';

-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "swiggy_url" TEXT;
