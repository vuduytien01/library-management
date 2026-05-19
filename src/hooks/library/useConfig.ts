import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { membersService } from "../../features/members/member-service";

export function useConfig() {
  const queryClient = useQueryClient();

  const getConfig = () =>
    useQuery({
      queryKey: ["system_config"],
      queryFn: () => membersService.getSystemConfig(),
    });

  const updateConfig = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      membersService.updateSystemConfig(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system_config"] });
    },
  });

  return {
    getConfig,
    updateConfig,
  };
}
