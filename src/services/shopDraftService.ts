interface ShopDraft {
  ownerId: string;
  name: string;
  description: string;
  category?: string;
  createdAt: number;
}

const drafts = new Map<string, ShopDraft>();

const DRAFT_TTL = 10 * 60 * 1000;

function cleanup(): void {
  const now = Date.now();

  for (const [userId, draft] of drafts) {
    if (now - draft.createdAt > DRAFT_TTL) {
      drafts.delete(userId);
    }
  }
}

export const shopDraftService = {
  set(data: {
    ownerId: string;
    name: string;
    description: string;
  }): void {
    cleanup();

    drafts.set(data.ownerId, {
      ...data,
      createdAt: Date.now(),
    });
  },

  get(ownerId: string): ShopDraft | null {
    cleanup();

    return drafts.get(ownerId) ?? null;
  },

  setCategory(ownerId: string, category: string): ShopDraft | null {
    cleanup();

    const draft = drafts.get(ownerId);

    if (!draft) {
      return null;
    }

    draft.category = category;

    drafts.set(ownerId, draft);

    return draft;
  },

  delete(ownerId: string): void {
    drafts.delete(ownerId);
  },
};
