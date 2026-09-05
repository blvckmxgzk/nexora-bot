type ProductCategory =
  | "game_topup"
  | "game_keys"
  | "gift_cards"
  | "digital_services"
  | "other";

interface ProductDraft {
  ownerId: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category?: ProductCategory;
  createdAt: number;
}

const drafts = new Map<string, ProductDraft>();

const DRAFT_TTL = 10 * 60 * 1000;

function cleanup(): void {
  const now = Date.now();

  for (const [userId, draft] of drafts) {
    if (now - draft.createdAt > DRAFT_TTL) {
      drafts.delete(userId);
    }
  }
}

export const productDraftService = {
  set(data: {
    ownerId: string;
    name: string;
    description: string;
    price: number;
    stock: number;
    category?: ProductCategory;
  }): void {
    cleanup();

    drafts.set(data.ownerId, {
      ...data,
      createdAt: Date.now(),
    });
  },

  get(ownerId: string): ProductDraft | null {
    cleanup();

    return drafts.get(ownerId) ?? null;
  },

  setCategory(
    ownerId: string,
    category: ProductCategory,
  ): ProductDraft | null {
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
