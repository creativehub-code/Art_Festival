import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './api';

// --- TYPES ---
export interface Program {
  _id: string;
  name: string;
  status: string;
  language?: string;
  updatedAt?: string;
  groupId?: Group;
  maxMarks?: number;
  isConversation?: boolean;
}

export interface Team {
  _id: string;
  name: string;
  totalScore?: number;
}

export interface Group {
  _id: string;
  name: string;
}

export interface Participant {
  _id: string;
  name: string;
  chestNumber?: string;
  teamId?: string | Team;
  groupId?: string | Group;
  programs?: Program[];
}

export interface Judge {
  _id: string;
  username: string;
  judgeGroupId?: string;
}

export interface JudgeGroup {
  _id: string;
  name: string;
  programs?: string[] | Program[];
}

// --- QUERIES ---

export const usePrograms = () => {
  return useQuery<Program[]>({
    queryKey: ['programs'],
    queryFn: async () => {
      const data = await apiRequest('/programs');
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useGroups = () => {
  return useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: async () => {
      const data = await apiRequest('/groups');
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useTeams = () => {
  return useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: async () => {
      const data = await apiRequest('/teams');
      return data.data || data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useParticipants = () => {
  return useQuery<Participant[]>({
    queryKey: ['participants'],
    queryFn: async () => {
      const data = await apiRequest('/participants');
      return data.data || data;
    },
    staleTime: 1 * 60 * 1000, // 1 minute since they change more often
  });
};

export const useJudges = () => {
  return useQuery<Judge[]>({
    queryKey: ['judges'],
    queryFn: async () => {
      const data = await apiRequest('/judges');
      return Array.isArray(data) ? data : [];
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useJudgeGroups = () => {
  return useQuery<JudgeGroup[]>({
    queryKey: ['judgeGroups'],
    queryFn: async () => {
      const data = await apiRequest('/judgeGroups');
      return data.data || (Array.isArray(data) ? data : []);
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useMarks = (programId: string | null) => {
  return useQuery({
    queryKey: ['marks', programId],
    queryFn: async () => {
      if (!programId) return { marks: [], assignedJudges: [] };
      const data = await apiRequest(`/marks/${programId}`);
      return data;
    },
    enabled: !!programId,
    staleTime: 1 * 60 * 1000, // fairly short, but we will have a manual refresh that ignores this
  });
};

export const useConversationPairs = (programId: string | null, isConversation: boolean) => {
  return useQuery({
    queryKey: ['conversationPairs', programId],
    queryFn: async () => {
      if (!programId || !isConversation) return [];
      const data = await apiRequest(`/conversation-pairs/by-program/${programId}`);
      return data || [];
    },
    enabled: !!programId && !!isConversation,
    staleTime: 5 * 60 * 1000,
  });
};

export const useSettings = () => {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const data = await apiRequest('/settings');
      return data || { firstPlacePoints: 5, secondPlacePoints: 3, thirdPlacePoints: 1 };
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });
};

export const useExportData = () => {
  return useQuery({
    queryKey: ['exportData'],
    queryFn: async () => {
      const data = await apiRequest('/marks/export-data');
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// --- MUTATIONS ---
// (We will add custom mutation hooks here if needed, or inline them in components. 
// For now, exposing a simple invalidation hook is useful)

export const useInvalidate = () => {
  const queryClient = useQueryClient();
  return {
    invalidatePrograms: () => queryClient.invalidateQueries({ queryKey: ['programs'] }),
    invalidateGroups: () => queryClient.invalidateQueries({ queryKey: ['groups'] }),
    invalidateTeams: () => queryClient.invalidateQueries({ queryKey: ['teams'] }),
    invalidateParticipants: () => queryClient.invalidateQueries({ queryKey: ['participants'] }),
    invalidateJudges: () => queryClient.invalidateQueries({ queryKey: ['judges'] }),
    invalidateJudgeGroups: () => queryClient.invalidateQueries({ queryKey: ['judgeGroups'] }),
    invalidateMarks: (programId: string) => queryClient.invalidateQueries({ queryKey: ['marks', programId] }),
  };
};
