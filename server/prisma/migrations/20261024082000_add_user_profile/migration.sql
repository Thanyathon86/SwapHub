-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarKey" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "username" TEXT NOT NULL DEFAULT ('user_'::text || substr(md5((random())::text), 1, 8));

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

