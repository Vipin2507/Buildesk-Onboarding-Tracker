import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteProjectFile,
  listProjectFiles,
  updateProjectFileMeta,
  uploadProjectFile,
} from "@/lib/api";
import type { ProjectFileCategory } from "@/types/project-file";

export const projectFilesKeys = {
  all: ["project-files"] as const,
  list: (projectId: string) => [...projectFilesKeys.all, "list", projectId] as const,
};

function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read file"));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function useProjectFiles(projectId: string, enabled = true) {
  return useQuery({
    queryKey: projectFilesKeys.list(projectId),
    queryFn: () => listProjectFiles({ data: { projectId } }),
    enabled: enabled && !!projectId,
    staleTime: 15_000,
  });
}

export function useUploadProjectFile(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      file: File;
      category?: ProjectFileCategory;
      purpose?: string;
      notes?: string;
    }) => {
      const dataBase64 = await fileToBase64(input.file);
      return uploadProjectFile({
        data: {
          projectId,
          fileName: input.file.name,
          mimeType: input.file.type || "application/octet-stream",
          dataBase64,
          category: input.category,
          purpose: input.purpose,
          notes: input.notes,
        },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectFilesKeys.list(projectId) });
    },
  });
}

export function useUpdateProjectFileMeta(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      category?: ProjectFileCategory;
      purpose?: string | null;
      notes?: string | null;
    }) => updateProjectFileMeta({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectFilesKeys.list(projectId) });
    },
  });
}

export function useDeleteProjectFile(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProjectFile({ data: { id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectFilesKeys.list(projectId) });
    },
  });
}
