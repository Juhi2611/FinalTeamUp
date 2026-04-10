import { getAuth, deleteUser } from "firebase/auth";

export const deleteAuthUser = async () => {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("No authenticated user");
  }

  await deleteUser(user);
};