-- CreateTable
CREATE TABLE "_ServiceStaff" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ServiceStaff_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ServiceStaff_B_index" ON "_ServiceStaff"("B");

-- AddForeignKey
ALTER TABLE "_ServiceStaff" ADD CONSTRAINT "_ServiceStaff_A_fkey" FOREIGN KEY ("A") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ServiceStaff" ADD CONSTRAINT "_ServiceStaff_B_fkey" FOREIGN KEY ("B") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

