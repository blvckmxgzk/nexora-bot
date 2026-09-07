import "dotenv/config";

import mongoose from "mongoose";

import {
  RiskVelocityBucket,
} from "../src/models/RiskVelocityBucket.js";

async function main() {
  const uri =
    process.env.MONGODB_URI ??
    process.env.DATABASE_URL;

  if (!uri) {
    throw new Error(
      "Missing MONGODB_URI / DATABASE_URL",
    );
  }

  const apply =
    process.argv.includes(
      "--apply",
    ) &&
    process.env
      .NEXORA_PHASE62_ALLOW_INDEX_REPAIR ===
      "YES";

  await mongoose.connect(
    uri,
    {
      autoIndex:
        false,
    },
  );

  const collection =
    RiskVelocityBucket.collection;

  const exists =
    await mongoose.connection.db
      ?.listCollections(
        {
          name:
            collection
              .collectionName,
        },
      )
      .hasNext();

  if (!exists) {
    console.log(
      JSON.stringify(
        {
          collection:
            collection
              .collectionName,

          exists:
            false,

          apply,

          message:
            "Collection ยังไม่มี — ไม่มี legacy index ให้ซ่อม",
        },
        null,
        2,
      ),
    );

    return;
  }

  const indexes =
    await collection.indexes();

  const expiresIndexes =
    indexes.filter(
      (index) =>
        index.key &&
        index.key.expiresAt ===
          1 &&
        Object.keys(
          index.key,
        ).length ===
          1,
    );

  const legacy =
    expiresIndexes.find(
      (index) =>
        index.expireAfterSeconds ===
          undefined,
    );

  const ttl =
    expiresIndexes.find(
      (index) =>
        index.expireAfterSeconds ===
          0,
    );

  console.log(
    JSON.stringify(
      {
        collection:
          collection
            .collectionName,

        apply,

        expiresIndexes:
          expiresIndexes.map(
            (index) => ({
              name:
                index.name,

              expireAfterSeconds:
                index
                  .expireAfterSeconds ??
                null,
            }),
          ),

        legacyIndex:
          legacy?.name ??
          null,

        ttlIndex:
          ttl?.name ??
          null,
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log(
      "ℹ️ Dry-run only. ไม่มี index ถูกแก้ไข",
    );

    return;
  }

  if (
    legacy?.name
  ) {
    console.log(
      `🧹 Dropping legacy index: ${legacy.name}`,
    );

    await collection.dropIndex(
      legacy.name,
    );
  }

  const afterDrop =
    await collection.indexes();

  const hasTtl =
    afterDrop.some(
      (index) =>
        index.key &&
        index.key.expiresAt ===
          1 &&
        Object.keys(
          index.key,
        ).length ===
          1 &&
        index.expireAfterSeconds ===
          0,
    );

  if (!hasTtl) {
    console.log(
      "🛠️ Creating TTL index ttl_risk_velocity_bucket",
    );

    await collection.createIndex(
      {
        expiresAt:
          1,
      },
      {
        expireAfterSeconds:
          0,

        name:
          "ttl_risk_velocity_bucket",
      },
    );
  }

  const finalIndexes =
    await collection.indexes();

  console.log(
    JSON.stringify(
      {
        status:
          "OK",

        finalExpiresIndexes:
          finalIndexes
            .filter(
              (index) =>
                index.key &&
                index.key
                  .expiresAt ===
                  1,
            )
            .map(
              (index) => ({
                name:
                  index.name,

                expireAfterSeconds:
                  index
                    .expireAfterSeconds ??
                  null,
              }),
            ),
      },
      null,
      2,
    ),
  );
}

main()
  .catch(
    (error) => {
      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  )
  .finally(
    async () => {
      await mongoose.disconnect();
    },
  );
