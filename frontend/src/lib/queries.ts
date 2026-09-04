import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './api';

export interface Criterion {
  _id: string;
  title: string;
  maxMarks: number;
  position?: number;
}

export interface CriterionMark {
  criterionId: string;
  title?: string;
  marksGiven: number;
}

export interface Program {
  _id: string;
  name: string;
  status: string;
  language?: string;
  topics?: { _id: string; title: string }[];
  criteria?: Criterion[];
  updatedAt?: string;
  groupId?: Group;
  maxMarks?: number;
  isConversation?: boolean;
  globalPosition?: number | null;
  languagePosition?: number | null;
}

export interface Team {
  _id: string;
  name: string;
  totalScore?: number;
  memberCount?: number;
}

export interface Group {
  _id: string;
  name: string;
  memberCount?: number;
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

export interface Language {
  _id: string;
  name: string;
  position: number;
  createdAt?: string;
  updatedAt?: string;
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

export const useLanguages = () => {
  return useQuery<Language[]>({
    queryKey: ['languages'],
    queryFn: async () => {
      const data = await apiRequest('/languages');
      return Array.isArray(data) ? data : [];
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

export const usePaginatedParticipants = (page: number = 1, limit: number = 50) => {
  return useQuery({
    queryKey: ['paginatedParticipants', page, limit],
    queryFn: async () => {
      const data = await apiRequest(`/participants?page=${page}&limit=${limit}`);
      return data;
    },
    staleTime: 1 * 60 * 1000,
  });
};

export const useTeamParticipants = (teamId: string | null, page: number = 1, limit: number = 20) => {
  return useQuery({
    queryKey: ['teamParticipants', teamId, page, limit],
    queryFn: async () => {
      if (!teamId) return { participants: [], total: 0, page: 1, pages: 1 };
      const data = await apiRequest(`/teams/${teamId}/participants?page=${page}&limit=${limit}`);
      return data;
    },
    enabled: !!teamId,
    staleTime: 1 * 60 * 1000,
  });
};

export const useGroupParticipants = (groupId: string | null, page: number = 1, limit: number = 20) => {
  return useQuery({
    queryKey: ['groupParticipants', groupId, page, limit],
    queryFn: async () => {
      if (!groupId) return { participants: [], total: 0, page: 1, pages: 1 };
      const data = await apiRequest(`/groups/${groupId}/participants?page=${page}&limit=${limit}`);
      return data;
    },
    enabled: !!groupId,
    staleTime: 1 * 60 * 1000,
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

export const useIndividualRankings = (groupId: string, page: number, limit: number, search: string) => {
  return useQuery({
    queryKey: ['individualRankings', { groupId, page, limit, search }],
    queryFn: async () => {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        groupId: groupId,
        search: search
      }).toString();
      const data = await apiRequest(`/rankings/individual?${queryParams}`);
      return data;
    },
    staleTime: 60 * 1000, // 1 minute
  });
};

export const useParticipantResults = (participantId: string | null) => {
  return useQuery({
    queryKey: ['participantResults', participantId],
    queryFn: async () => {
      if (!participantId) return null;
      const data = await apiRequest(`/rankings/individual/${participantId}/results`);
      return data;
    },
    enabled: !!participantId,
    staleTime: 2 * 60 * 1000,
  });
};

// --- REVIEW MARKS HOOKS ---

export const useReviewPrograms = () => {
  return useQuery<any[]>({
    queryKey: ['reviewPrograms'],
    queryFn: async () => {
      const data = await apiRequest('/marks/review/programs');
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export interface ReviewProgramMarksResponse {
  marks: any[];
  assignedJudges: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const useReviewProgramMarks = (
  programId: string | null,
  page: number = 1,
  limit: number = 50,
  search: string = ''
) => {
  return useQuery<ReviewProgramMarksResponse>({
    queryKey: ['reviewProgramMarks', programId, page, limit, search],
    queryFn: async () => {
      if (!programId) {
        return { marks: [], assignedJudges: [], total: 0, page: 1, limit: 50, totalPages: 0 };
      }
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search ? { search } : {}),
      });
      const data = await apiRequest(`/marks/review/program/${programId}?${params}`);
      return data;
    },
    enabled: !!programId,
    staleTime: 1 * 60 * 1000, // 1 minute — allows cache reuse when switching pages/tabs
  });
};

// --- MUTATIONS ---
// (We will add custom mutation hooks here if needed, or inline them in components. 
// For now, exposing a simple invalidation hook is useful)

export const useInvalidate = () => {
  const queryClient = useQueryClient();
  return {
    invalidatePrograms: () => queryClient.invalidateQueries({ queryKey: ['programs'] }),
    invalidateLanguages: () => queryClient.invalidateQueries({ queryKey: ['languages'] }),
    invalidateGroups: () => queryClient.invalidateQueries({ queryKey: ['groups'] }),
    invalidateTeams: () => queryClient.invalidateQueries({ queryKey: ['teams'] }),
    invalidateParticipants: () => {
      queryClient.invalidateQueries({ queryKey: ['participants'] });
      queryClient.invalidateQueries({ queryKey: ['paginatedParticipants'] });
    },
    invalidateJudges: () => queryClient.invalidateQueries({ queryKey: ['judges'] }),
    invalidateJudgeGroups: () => queryClient.invalidateQueries({ queryKey: ['judgeGroups'] }),
    invalidateMarks: (programId: string) => queryClient.invalidateQueries({ queryKey: ['marks', programId] }),
    invalidateTeamParticipants: (teamId: string) => queryClient.invalidateQueries({ queryKey: ['teamParticipants', teamId] }),
    invalidateGroupParticipants: (groupId: string) => queryClient.invalidateQueries({ queryKey: ['groupParticipants', groupId] }),
    // Review Marks targeted invalidation
    invalidateReviewPrograms: () => queryClient.invalidateQueries({ queryKey: ['reviewPrograms'] }),
    invalidateReviewProgramMarks: (programId: string) =>
      queryClient.invalidateQueries({ queryKey: ['reviewProgramMarks', programId] }),
    invalidateIndividualRankings: () => {
      queryClient.invalidateQueries({ queryKey: ['individualRankings'] });
      queryClient.invalidateQueries({ queryKey: ['participantResults'] });
    }
  };
};
