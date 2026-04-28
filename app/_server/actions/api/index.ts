"use server";

import { randomBytes } from "crypto";
import { USERS_FILE } from "@/app/_consts/files";
import { readJsonFile, writeJsonFile } from "../file";
import { getCurrentUser } from "@/app/_server/actions/users";
import { Result, User } from "@/app/_types";

export const generateApiKey = async (): Promise<Result<string>> => {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const users = await readJsonFile(USERS_FILE);
    const userIndex = users.findIndex(
      (u: User) => u.username === currentUser.username
    );

    if (userIndex === -1) {
      return { success: false, error: "User not found" };
    }

    const prefix = "ck_";
    const newApiKey = prefix + randomBytes(32).toString("hex");

    users[userIndex].apiKey = newApiKey;

    await writeJsonFile(users, USERS_FILE);

    return { success: true, data: newApiKey };
  } catch (error) {
    console.error("Error generating API key:", error);
    return { success: false, error: "Failed to generate API key" };
  }
};

export const getApiKey = async (): Promise<Result<string | null>> => {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    const users = await readJsonFile(USERS_FILE);
    const user = users.find((u: User) => u.username === currentUser.username);

    if (!user) {
      return { success: false, error: "User not found" };
    }

    return { success: true, data: user.apiKey || null };
  } catch (error) {
    console.error("Error getting API key:", error);
    return { success: false, error: "Failed to get API key" };
  }
};

export const authenticateApiKey = async (
  apiKey: string
): Promise<User | null> => {
  try {
    if (!apiKey) {
      return null;
    }

    const users = await readJsonFile(USERS_FILE);
    const user = users.find((u: User) => u.apiKey === apiKey);

    return user || null;
  } catch (error) {
    console.error("Error authenticating API key:", error);
    return null;
  }
};
