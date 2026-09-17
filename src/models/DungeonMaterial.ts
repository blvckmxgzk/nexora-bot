import {
  Schema,
  model,
} from "mongoose";

const dungeonMaterialSchema =
  new Schema(
    {
      discordId: {
        type: String,
        required: true,
        index: true,
      },

      materialId: {
        type: String,
        required: true,
      },

      name: {
        type: String,
        required: true,
      },

      quantity: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

dungeonMaterialSchema.index(
  {
    discordId: 1,
    materialId: 1,
  },
  {
    unique: true,
  },
);

export const DungeonMaterial =
  model(
    "DungeonMaterial",
    dungeonMaterialSchema,
  );
