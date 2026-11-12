"use server";

import {
  getConfig,
  setConfig,
  validatePath,
} from "@/lib/services/config-service";
import { redirect } from "next/navigation";

export async function checkConfig() {
  const config = await getConfig();
  return config;
}

export async function saveRootDirectory(formData: FormData) {
  const value = formData.get("rootDirectory");
  const rootDirectory = typeof value === "string" ? value.trim() : "";

  if (!rootDirectory) {
    return { error: "Path is required" };
  }

  const isValid = await validatePath(rootDirectory);

  if (!isValid) {
    return {
      error: "Enter an absolute path to an existing, accessible directory.",
    };
  }

  await setConfig({ rootDirectory });
  redirect("/");
}

export async function validateDirectoryPath(path: string) {
  return await validatePath(path);
}
