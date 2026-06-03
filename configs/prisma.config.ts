import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // For Prisma CLI operations like db push, we use the Direct URL
    url: process.env["DIRECT_URL"],
  },
});
