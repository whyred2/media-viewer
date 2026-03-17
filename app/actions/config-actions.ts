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
  const rootDirectory = formData.get("rootDirectory") as string;

  if (!rootDirectory) {
    return { error: "Path is required" };
  }

  const isValid = await validatePath(rootDirectory);

  if (!isValid) {
    return {
      error: "Invalid path. Directory does not exist or is not accessible.",
    };
  }

  await setConfig({ rootDirectory });
  redirect("/");
}

export async function validateDirectoryPath(path: string) {
  return await validatePath(path);
}
