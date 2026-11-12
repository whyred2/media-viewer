"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  saveRootDirectory,
  validateDirectoryPath,
} from "@/app/actions/config-actions";
import { FolderOpen, Loader2, CheckCircle, XCircle } from "lucide-react";

export function SetupForm() {
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isPending, startTransition] = useTransition();

  const handlePathChange = async (value: string) => {
    setPath(value);
    setError(null);
    setIsValid(null);

    if (value.trim().length > 2) {
      setIsValidating(true);
      const valid = await validateDirectoryPath(value);
      setIsValid(valid);
      setIsValidating(false);
    }
  };

  const handleSubmit = async (formData: FormData) => {
    startTransition(async () => {
      const result = await saveRootDirectory(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-primary/10 rounded-full">
            <FolderOpen className="w-12 h-12 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl">Welcome to LocalGallery</CardTitle>
        <CardDescription>
          Enter the path to your photos and videos folder to get started
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="rootDirectory" className="text-sm font-medium">
              Media Directory Path
            </label>
            <div className="relative">
              <Input
                id="rootDirectory"
                name="rootDirectory"
                type="text"
                placeholder="D:\Photos or /home/user/photos"
                value={path}
                onChange={(e) => handlePathChange(e.target.value)}
                className="pr-10"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isValidating && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                )}
                {!isValidating && isValid === true && (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                )}
                {!isValidating && isValid === false && path.length > 2 && (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {!isValidating && isValid === false && path.length > 2 && (
              <p className="text-sm text-destructive">
                This directory does not exist or is not accessible
              </p>
            )}
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={isPending || !isValid}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Setting up...
              </>
            ) : (
              "Start Browsing"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
