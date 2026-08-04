/*
  Warnings:

  - Added the required column `key` to the `ProductImage` table without a default value. This is not possible if the table is not empty.

*/
-- Delete Data
TRUNCATE TABLE "ProductImage" CASCADE;
-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "key" TEXT NOT NULL;
