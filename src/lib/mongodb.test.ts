import { describe, expect, it } from "vitest";
import { dbConnect } from "./mongodb";

describe("test safety: never connect to a real MONGODB_URI", () => {
  it("MONGODB_URI is unset during tests (vitest.setup.ts must delete it)", () => {
    expect(process.env.MONGODB_URI).toBeUndefined();
  });

  it("dbConnect() resolves to a local in-memory server, not a real cluster", async () => {
    const mongoose = await dbConnect();
    const host = mongoose.connection.host;
    expect(host).not.toMatch(/mongodb\.net/);
    expect(host === "127.0.0.1" || host === "localhost").toBe(true);
  });
});
