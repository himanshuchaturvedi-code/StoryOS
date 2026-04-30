-- CreateEnum
CREATE TYPE "CptcRole" AS ENUM (
  'DIRECTOR',
  'SCREENWRITER',
  'LEAD_PERFORMER_1',
  'LEAD_PERFORMER_2',
  'DIRECTOR_OF_PHOTOGRAPHY',
  'ART_DIRECTOR',
  'MUSIC_COMPOSER',
  'PICTURE_EDITOR'
);

-- AlterTable
ALTER TABLE "budget_template_accounts" ADD COLUMN "cptcRole" "CptcRole";

-- AlterTable
ALTER TABLE "budget_accounts" ADD COLUMN "cptcRole" "CptcRole";
