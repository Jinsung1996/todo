import { dbConnect } from "@/lib/mongodb";
import Todo from "@/models/Todo";

/** Claims all pre-auth todos (no userId set) for the given user. Returns the count claimed. */
export async function claimOrphanTodos(userId: string): Promise<number> {
  await dbConnect();
  const result = await Todo.updateMany(
    { userId: { $exists: false } },
    { $set: { userId } }
  );
  return result.modifiedCount;
}
