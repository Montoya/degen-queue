-- CreateTable
CREATE TABLE "Likes" (
    "fid" INTEGER NOT NULL,
    "messageHash" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "castAuthor" INTEGER NOT NULL,
    "castHash" TEXT NOT NULL,

    CONSTRAINT "Likes_pkey" PRIMARY KEY ("fid","castAuthor","castHash")
);
