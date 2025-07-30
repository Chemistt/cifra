import { useTRPC } from "@/trpc/react";

const useAddTagToItem = () => useTRPC().files.addTagToItem.useMutation();

export { useAddTagToItem };