import { describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { dbConnect } from "./mongodb";
import { assertTestDatabase } from "./testDbGuard";

describe("assertTestDatabase", () => {
  it("does not throw when connected to the local in-memory server", async () => {
    await dbConnect();
    expect(() => assertTestDatabase()).not.toThrow();
  });

  it("throws when the connection host looks like a real (non-local) database", async () => {
    await dbConnect();
    const spy = vi
      .spyOn(mongoose.connection, "host", "get")
      .mockReturnValue("example-cluster.mongodb.net");
    expect(() => assertTestDatabase()).toThrow(/Refusing to run destructive/);
    spy.mockRestore();
  });
});
