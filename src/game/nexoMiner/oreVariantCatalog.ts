export const ORE_MUTATIONS = [
  {
    id: "shiny",
    name: "Shiny",
    emoji: "✨",
    weight: 5000,
    valueMultiplier: "1.5",
    sizeMultiplier: "1",
  },
  {
    id: "golden",
    name: "Golden",
    emoji: "🟡",
    weight: 2500,
    valueMultiplier: "2.5",
    sizeMultiplier: "1.05",
  },
  {
    id: "crystal",
    name: "Crystal",
    emoji: "💎",
    weight: 1200,
    valueMultiplier: "5",
    sizeMultiplier: "1.15",
  },
  {
    id: "radioactive",
    name: "Radioactive",
    emoji: "☢️",
    weight: 500,
    valueMultiplier: "12",
    sizeMultiplier: "1.3",
  },
  {
    id: "void",
    name: "Void",
    emoji: "🌑",
    weight: 180,
    valueMultiplier: "30",
    sizeMultiplier: "1.6",
  },
  {
    id: "celestial",
    name: "Celestial",
    emoji: "🌠",
    weight: 60,
    valueMultiplier: "100",
    sizeMultiplier: "2",
  },
  {
    id: "glitched",
    name: "Glitched",
    emoji: "👾",
    weight: 15,
    valueMultiplier: "500",
    sizeMultiplier: "3",
  },
  {
    id: "singularity",
    name: "Singularity",
    emoji: "🕳️",
    weight: 3,
    valueMultiplier: "2500",
    sizeMultiplier: "5",
  },
  {
    id: "omega",
    name: "Omega",
    emoji: "Ω",
    weight: 1,
    valueMultiplier: "10000",
    sizeMultiplier: "10",
  },
] as const;

export type OreMutationId =
  typeof ORE_MUTATIONS[number]["id"];

export type OreMutationOrNone =
  OreMutationId | "none";

export const ORE_MUTATION_MAP =
  new Map(
    ORE_MUTATIONS.map(
      (mutation) => [
        mutation.id,
        mutation,
      ],
    ),
  );

export const MINER_SIZE_CLASSES = [
  {
    id: "normal",
    min: "1",
    emoji: "⚪",
  },
  {
    id: "large",
    min: "2",
    emoji: "🟢",
  },
  {
    id: "giant",
    min: "5",
    emoji: "🔵",
  },
  {
    id: "colossal",
    min: "1e1",
    emoji: "🟣",
  },
  {
    id: "titan",
    min: "2.5e1",
    emoji: "🔴",
  },
  {
    id: "mega",
    min: "1e2",
    emoji: "🟠",
  },
  {
    id: "giga",
    min: "1e3",
    emoji: "🟡",
  },
  {
    id: "tera",
    min: "1e5",
    emoji: "💠",
  },
  {
    id: "planetary",
    min: "1e8",
    emoji: "🌍",
  },
  {
    id: "stellar",
    min: "1e12",
    emoji: "⭐",
  },
  {
    id: "galactic",
    min: "1e20",
    emoji: "🌌",
  },
  {
    id: "universal",
    min: "1e35",
    emoji: "🪐",
  },
  {
    id: "multiversal",
    min: "1e60",
    emoji: "🌀",
  },
  {
    id: "infinite",
    min: "1e100",
    emoji: "∞",
  },
  {
    id: "omega",
    min: "1e250",
    emoji: "Ω",
  },
] as const;

export type MinerSizeClass =
  typeof MINER_SIZE_CLASSES[number]["id"];

export const MINER_SIZE_RANK =
  Object.fromEntries(
    MINER_SIZE_CLASSES.map(
      (entry, index) => [
        entry.id,
        index,
      ],
    ),
  ) as Record<
    MinerSizeClass,
    number
  >;
