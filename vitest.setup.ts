// Vite auto-loads .env.local into process.env, which can include a real
// MONGODB_URI (e.g. a production Atlas cluster). Tests must NEVER be able to
// connect to that — delete it unconditionally so dbConnect() always falls
// back to the in-memory mongodb-memory-server for every test run.
delete process.env.MONGODB_URI;
