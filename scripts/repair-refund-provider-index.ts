import "dotenv/config";

import mongoose from "mongoose";

const uri =
  process.env.MONGODB_URI ??
  process.env.DATABASE_URL;

if (!uri) {
  throw new Error(
    "Missing MONGODB_URI / DATABASE_URL",
  );
}

async function main() {
  /*
   * สำคัญ:
   * ห้าม import Refund model ใน script นี้
   * เพราะเราต้อง repair index ก่อน Mongoose
   * พยายาม initialize schema indexes
   */
  await mongoose.connect(
    uri,
    {
      autoIndex:
        false,
    },
  );

  try {
    const db =
      mongoose.connection.db;

    if (!db) {
      throw new Error(
        "MongoDB connection ไม่มี db handle",
      );
    }

    const collections =
      await db
        .listCollections(
          {},
          {
            nameOnly:
              true,
          },
        )
        .toArray();

    if (
      !collections.some(
        (item) =>
          item.name ===
          "refunds",
      )
    ) {
      throw new Error(
        'ไม่พบ collection "refunds"',
      );
    }

    const refunds =
      db.collection(
        "refunds",
      );

    console.log(
      "===== Current Refund Indexes =====",
    );

    const before =
      await refunds.indexes();

    console.log(
      JSON.stringify(
        before,
        null,
        2,
      ),
    );

    /*
     * ก่อนสร้าง unique index
     * ต้องพิสูจน์ก่อนว่าไม่มี
     * providerRefundId string ซ้ำ
     */
    const duplicates =
      await refunds
        .aggregate([
          {
            $match: {
              providerRefundId: {
                $type:
                  "string",
              },
            },
          },

          {
            $group: {
              _id:
                "$providerRefundId",

              count: {
                $sum:
                  1,
              },

              refundIds: {
                $push:
                  "$refundId",
              },
            },
          },

          {
            $match: {
              count: {
                $gt:
                  1,
              },
            },
          },

          {
            $limit:
              20,
          },
        ])
        .toArray();

    if (
      duplicates.length >
      0
    ) {
      console.error(
        "❌ พบ providerRefundId ซ้ำ:",
      );

      console.error(
        JSON.stringify(
          duplicates,
          null,
          2,
        ),
      );

      throw new Error(
        "ABORT: ห้ามสร้าง unique Refund index จนกว่าจะตรวจ duplicate records",
      );
    }

    console.log(
      "✅ No duplicate string providerRefundId values",
    );

    const indexes =
      await refunds
        .indexes();

    const target =
      indexes.find(
        (index) =>
          index.name ===
          "uniq_provider_refund_id",
      );

    if (target) {
      console.log(
        "ℹ️ target index already exists",
      );
    } else {
      const legacy =
        indexes.find(
          (index) =>
            index.name ===
            "providerRefundId_1",
        );

      if (legacy) {
        console.log(
          "🧹 Dropping legacy providerRefundId_1 index",
        );

        await refunds
          .dropIndex(
            "providerRefundId_1",
          );
      }

      console.log(
        "🔒 Creating partial unique Refund provider index",
      );

      await refunds
        .createIndex(
          {
            providerRefundId:
              1,
          },
          {
            name:
              "uniq_provider_refund_id",

            unique:
              true,

            partialFilterExpression: {
              providerRefundId: {
                $type:
                  "string",
              },
            },
          },
        );
    }

    console.log(
      "===== Final Refund Indexes =====",
    );

    console.log(
      JSON.stringify(
        await refunds.indexes(),
        null,
        2,
      ),
    );

    console.log(
      "✅ Refund provider index repair complete",
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(
  (error) => {
    console.error(
      "❌ Refund index repair failed:",
      error,
    );

    process.exitCode =
      1;
  },
);
