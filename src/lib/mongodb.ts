import mongoose from "mongoose";

declare global {
  var __mongooseConn: Promise<typeof mongoose> | undefined;
  var __mongoMemoryUri: Promise<string> | undefined;
}

async function resolveUri(): Promise<string> {
  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI;
  }

  if (!global.__mongoMemoryUri) {
    global.__mongoMemoryUri = (async () => {
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      const server = await MongoMemoryServer.create();
      return server.getUri("todo");
    })();
  }

  return global.__mongoMemoryUri;
}

export async function dbConnect(): Promise<typeof mongoose> {
  if (!global.__mongooseConn) {
    global.__mongooseConn = resolveUri()
      .then((uri) => mongoose.connect(uri))
      .catch((err) => {
        global.__mongooseConn = undefined;
        throw err;
      });
  }

  return global.__mongooseConn;
}
