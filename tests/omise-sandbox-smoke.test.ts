import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import mongoose from "mongoose";

import {
  MongoMemoryReplSet,
} from "mongodb-memory-server";

import {
  Payout,
} from "../src/models/Payout.ts";

import {
  payoutService,
} from "../src/services/payoutService.ts";

import {
  omisePayoutProvider,
} from "../src/services/payment/providers/omisePayoutProvider.ts";

const RUN_SMOKE =
  process.env.RUN_OMISE_SMOKE ===
  "1";

const describeSmoke =
  RUN_SMOKE
    ? describe
    : describe.skip;

let replSet:
  | MongoMemoryReplSet
  | undefined;

interface SmokeState {
  smokeId: string;

  recipientId?:
    string;

  transferId?:
    string;
}

function getSmokeStatePath(
  smokeId:
    string,
): string {
  return path.join(
    process.cwd(),
    ".nexora-smoke",
    `omise-${smokeId}.json`,
  );
}

function loadSmokeState(
  smokeId:
    string,
): SmokeState {
  const statePath =
    getSmokeStatePath(
      smokeId,
    );

  if (
    !fs.existsSync(
      statePath,
    )
  ) {
    return {
      smokeId,
    };
  }

  const parsed =
    JSON.parse(
      fs.readFileSync(
        statePath,
        "utf8",
      ),
    ) as SmokeState;

  if (
    parsed.smokeId !==
    smokeId
  ) {
    throw new Error(
      "Omise smoke state ID mismatch",
    );
  }

  return parsed;
}

function saveSmokeState(
  state:
    SmokeState,
): void {
  const statePath =
    getSmokeStatePath(
      state.smokeId,
    );

  fs.mkdirSync(
    path.dirname(
      statePath,
    ),
    {
      recursive:
        true,
    },
  );

  const tempPath =
    `${statePath}.tmp`;

  fs.writeFileSync(
    tempPath,
    JSON.stringify(
      state,
      null,
      2,
    ) + "\n",
    {
      mode:
        0o600,
    },
  );

  fs.renameSync(
    tempPath,
    statePath,
  );
}

interface OmiseAccount {
  id:
    string;

  livemode:
    boolean;

  country?:
    string;

  currency?:
    string;

  auto_activate_recipients?:
    boolean;
}

interface OmiseBalance {
  livemode:
    boolean;

  currency:
    string;

  total:
    number;

  transferable:
    number;

  on_hold?:
    number;

  reserve?:
    number;
}

function getSecretKey():
  string {
  const key =
    process.env
      .OMISE_SECRET_KEY
      ?.trim();

  if (!key) {
    throw new Error(
      "Missing OMISE_SECRET_KEY",
    );
  }

  if (
    !key.startsWith(
      "skey_test_",
    )
  ) {
    throw new Error(
      "Phase 5.5 smoke test รองรับเฉพาะ skey_test_ เท่านั้น",
    );
  }

  return key;
}

async function omiseGet<T>(
  path:
    string,
): Promise<T> {
  const key =
    getSecretKey();

  const auth =
    Buffer.from(
      `${key}:`,
    ).toString(
      "base64",
    );

  const response =
    await fetch(
      `https://api.omise.co${path}`,
      {
        method:
          "GET",

        headers: {
          Authorization:
            `Basic ${auth}`,

          Accept:
            "application/json",
        },

        signal:
          AbortSignal.timeout(
            15_000,
          ),
      },
    );

  const text =
    await response.text();

  let data:
    any;

  try {
    data =
      JSON.parse(
        text,
      );
  } catch {
    throw new Error(
      `Omise returned invalid JSON for ${path}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.message ??
        `Omise request failed: HTTP ${response.status}`,
    );
  }

  return data as T;
}

describeSmoke(
  "NEXORA Phase 5.5 Omise Sandbox Smoke",
  () => {
    beforeAll(
      async () => {
        getSecretKey();

        replSet =
          await MongoMemoryReplSet
            .create({
              instanceOpts: [
                {
                  launchTimeout:
                    120_000,
                },
              ],

              replSet: {
                count: 1,

                storageEngine:
                  "wiredTiger",
              },
            });

        await mongoose.connect(
          replSet.getUri(),
          {
            dbName:
              "nexora-phase55-omise-smoke",
          },
        );

        await Payout
          .syncIndexes();
      },
      120_000,
    );

    afterAll(
      async () => {
        if (
          mongoose.connection
            .readyState !==
          0
        ) {
          try {
            await mongoose.connection
              .dropDatabase();
          } finally {
            await mongoose.disconnect();
          }
        }

        if (replSet) {
          await replSet.stop();
        }
      },
      120_000,
    );

    it(
      "runs Recipient -> Verify -> Transfer -> Sent -> Paid -> NEXORA reconciliation",
      async () => {
        const rawSmokeId =
          process.env
            .OMISE_SMOKE_ID
            ?.trim() ||
          "PH55";

        const smokeId =
          rawSmokeId.replace(
            /[^A-Za-z0-9_-]/g,
            "_",
          );

        const payoutAccountId =
          `PACC-SMOKE-${smokeId}`;

        const sellerId =
          `SELLER-SMOKE-${smokeId}`;

        const shopId =
          `SHOP-SMOKE-${smokeId}`;

        const payoutId =
          `PO-SMOKE-${smokeId}`;

        const amountSatang =
          Number(
            process.env
              .OMISE_SMOKE_AMOUNT_SATANG ??
              "5000",
          );

        if (
          !Number.isSafeInteger(
            amountSatang,
          ) ||
          amountSatang <
            3000
        ) {
          throw new Error(
            "OMISE_SMOKE_AMOUNT_SATANG ต้องเป็น integer >= 3000",
          );
        }

        console.log(
          "\n===== Omise Account =====",
        );

        const account =
          await omiseGet<OmiseAccount>(
            "/account",
          );

        expect(
          account.livemode,
        ).toBe(
          false,
        );

        console.log(
          `account=${account.id}`,
        );

        console.log(
          `country=${account.country ?? "-"}`,
        );

        console.log(
          `auto_activate_recipients=${String(
            account.auto_activate_recipients,
          )}`,
        );

        console.log(
          "\n===== Omise Balance =====",
        );

        const balance =
          await omiseGet<OmiseBalance>(
            "/balance",
          );

        expect(
          balance.livemode,
        ).toBe(
          false,
        );

        expect(
          balance.currency
            .toUpperCase(),
        ).toBe(
          "THB",
        );

        console.log(
          `total=${balance.total}`,
        );

        console.log(
          `transferable=${balance.transferable}`,
        );

        const smokeState =
          loadSmokeState(
            smokeId,
          );

        console.log(
          `state=${getSmokeStatePath(
            smokeId,
          )}`,
        );

        console.log(
          "\n===== Recipient =====",
        );

        let recipient;

        if (
          smokeState.recipientId
        ) {
          /*
           * Local state เป็น source of truth
           *
           * ถ้า retrieve fail:
           * FAIL CLOSED
           *
           * ห้าม fallback ไปสร้าง Recipient ใหม่
           * เพราะอาจเป็นแค่ network outage
           */
          recipient =
            await omisePayoutProvider
              .retrieveRecipient(
                smokeState.recipientId,
              );

          console.log(
            `♻️ state recipient=${recipient.recipientId}`,
          );
        } else {
          /*
           * ใช้ Search เฉพาะ recovery:
           *
           * กรณี process ก่อนหน้าสร้าง Recipient
           * สำเร็จที่ Omise แต่ crash ก่อน
           * saveSmokeState()
           */
          recipient =
            await omisePayoutProvider
              .findExistingRecipient({
                payoutAccountId,
                sellerId,
                shopId,
              });

          if (recipient) {
            console.log(
              `♻️ recovered recipient=${recipient.recipientId}`,
            );

            smokeState.recipientId =
              recipient.recipientId;

            saveSmokeState(
              smokeState,
            );
          } else {
            recipient =
              await omisePayoutProvider
                .createRecipient({
                  payoutAccountId,
                  sellerId,
                  shopId,

                  accountHolderName:
                    "NEXORA PH55 TEST",

                  bankCode:
                    "test",

                  accountNumber:
                    "acc12345",
                });

            /*
             * Save ทันทีหลัง provider success
             * ก่อน verify หรือ operation อื่น
             */
            smokeState.recipientId =
              recipient.recipientId;

            saveSmokeState(
              smokeState,
            );

            console.log(
              `✅ created recipient=${recipient.recipientId}`,
            );
          }
        }

        if (
          !recipient.verified
        ) {
          recipient =
            await omisePayoutProvider
              .verifyRecipientForTest(
                recipient.recipientId,
              );

          console.log(
            `✅ verified recipient=${recipient.recipientId}`,
          );
        }

        recipient =
          await omisePayoutProvider
            .retrieveRecipient(
              recipient.recipientId,
            );

        expect(
          recipient.verified,
        ).toBe(
          true,
        );

        if (
          !recipient.active
        ) {
          throw new Error(
            [
              "",
              "ACTION_REQUIRED: Recipient verified แล้วแต่ยัง inactive",
              "",
              `Recipient ID: ${recipient.recipientId}`,
              "",
              "ไปที่ Omise Test Dashboard > Recipients",
              "เปิด Recipient นี้ แล้วกด Activate",
              "",
              "จากนั้นรัน smoke command เดิมซ้ำ",
              "ระบบจะ reuse Recipient เดิมและไม่สร้างซ้ำ",
            ].join(
              "\n",
            ),
          );
        }

        console.log(
          `active=${recipient.active}`,
        );

        console.log(
          `verified=${recipient.verified}`,
        );

        console.log(
          `bank=${recipient.bankCode ?? "-"}`,
        );

        console.log(
          `last_digits=${recipient.bankLastDigits ?? "-"}`,
        );

        console.log(
          "\n===== Transfer =====",
        );

        let transfer;

        if (
          smokeState.transferId
        ) {
          /*
           * มี Transfer ID แล้ว:
           * retrieve อย่างเดียว
           *
           * ห้ามสร้าง Transfer ที่สอง
           * ไม่ว่า retrieve จะ fail เพราะอะไร
           */
          transfer =
            await omisePayoutProvider
              .retrieveTransfer(
                smokeState.transferId,
              );

          console.log(
            `♻️ state transfer=${transfer.providerTransferId}`,
          );
        } else {
          /*
           * Search ใช้เฉพาะ ambiguous-crash recovery
           */
          transfer =
            await omisePayoutProvider
              .findExistingTransfer({
                payoutId,
                sellerId,
                shopId,

                recipientId:
                  recipient.recipientId,

                amountSatang,
              });

          if (transfer) {
            console.log(
              `♻️ recovered transfer=${transfer.providerTransferId}`,
            );

            smokeState.transferId =
              transfer.providerTransferId;

            saveSmokeState(
              smokeState,
            );
          } else {
            if (
              balance.transferable <
              amountSatang
            ) {
              throw new Error(
                [
                  "",
                  "ACTION_REQUIRED: Omise Test transferable balance ไม่พอ",
                  "",
                  `ต้องการ: ${amountSatang} satang`,
                  `มีอยู่: ${balance.transferable} satang`,
                  "",
                  "ให้สร้าง Payment สำเร็จใน Omise Test Mode ก่อน",
                  "จากนั้นรัน smoke command เดิมซ้ำ",
                ].join(
                  "\n",
                ),
              );
            }

            transfer =
              await omisePayoutProvider
                .createTransfer({
                  payoutId,
                  sellerId,
                  shopId,

                  recipientId:
                    recipient.recipientId,

                  amountSatang,

                  idempotencyKey:
                    `nexora-smoke-${smokeId}`,
                });

            /*
             * Save provider ID ทันที
             * ก่อน mark sent / paid
             */
            smokeState.transferId =
              transfer.providerTransferId;

            saveSmokeState(
              smokeState,
            );

            console.log(
              `✅ created transfer=${transfer.providerTransferId}`,
            );
          }
        }

        expect(
          transfer
            .providerTransferId
            .startsWith(
              "trsf_test_",
            ),
        ).toBe(
          true,
        );

        expect(
          transfer.recipientId,
        ).toBe(
          recipient.recipientId,
        );

        expect(
          transfer.amountSatang,
        ).toBe(
          amountSatang,
        );

        expect(
          transfer.currency,
        ).toBe(
          "THB",
        );

        if (
          transfer.failureCode
        ) {
          throw new Error(
            `Omise Transfer failed: ${transfer.failureCode} ${transfer.failureMessage ?? ""}`,
          );
        }

        transfer =
          await omisePayoutProvider
            .retrieveTransfer(
              transfer.providerTransferId,
            );

        if (
          !transfer.sent &&
          !transfer.paid
        ) {
          transfer =
            await omisePayoutProvider
              .markTransferSentForTest(
                transfer.providerTransferId,
              );

          console.log(
            "✅ marked transfer as sent",
          );
        }

        if (
          !transfer.paid
        ) {
          transfer =
            await omisePayoutProvider
              .markTransferPaidForTest(
                transfer.providerTransferId,
              );

          console.log(
            "✅ marked transfer as paid",
          );
        }

        transfer =
          await omisePayoutProvider
            .retrieveTransfer(
              transfer.providerTransferId,
            );

        expect(
          transfer.sent,
        ).toBe(
          true,
        );

        expect(
          transfer.paid,
        ).toBe(
          true,
        );

        expect(
          transfer.feeSatang,
        ).not.toBeNull();

        expect(
          transfer.netSatang,
        ).not.toBeNull();

        expect(
          transfer.netSatang,
        ).toBe(
          amountSatang -
            transfer.feeSatang!,
        );

        console.log(
          "\n===== Real Omise Accounting =====",
        );

        console.log(
          `amount=${transfer.amountSatang}`,
        );

        console.log(
          `fee=${transfer.feeSatang}`,
        );

        console.log(
          `net=${transfer.netSatang}`,
        );

        console.log(
          "\n===== Provider Recovery =====",
        );

        const searched =
          await omisePayoutProvider
            .findExistingTransfer({
              payoutId,
              sellerId,
              shopId,

              recipientId:
                recipient.recipientId,

              amountSatang,
            });

        expect(
          searched,
        ).not.toBeNull();

        expect(
          searched
            ?.providerTransferId,
        ).toBe(
          transfer.providerTransferId,
        );

        console.log(
          "✅ Transfer provider recovery passed",
        );

        console.log(
          "\n===== NEXORA Local Reconciliation =====",
        );

        await Payout.create({
          payoutId,
          sellerId,
          shopId,

          payoutAccountId,

          provider:
            "omise",

          recipientId:
            recipient.recipientId,

          amountSatang,

          currency:
            "THB",

          feePolicy:
            "seller_pays",

          status:
            "submitted",

          idempotencyKey:
            `nexora-smoke-${smokeId}`,

          providerTransferId:
            transfer.providerTransferId,

          submittedAt:
            new Date(),
        });

        const reconciled =
          await payoutService
            .processPayout(
              payoutId,
            );

        expect(
          reconciled.status,
        ).toBe(
          "paid",
        );

        expect(
          reconciled
            .providerTransferId,
        ).toBe(
          transfer.providerTransferId,
        );

        expect(
          reconciled
            .feeSatang,
        ).toBe(
          transfer.feeSatang,
        );

        expect(
          reconciled
            .netSatang,
        ).toBe(
          transfer.netSatang,
        );

        expect(
          reconciled
            .lastReconciledAt,
        ).toBeInstanceOf(
          Date,
        );

        console.log(
          "✅ NEXORA reconciliation passed",
        );

        console.log(
          "\n================================",
        );

        console.log(
          "✅ PHASE 5.5 OMISE SANDBOX SMOKE PASSED",
        );

        console.log(
          `recipient=${recipient.recipientId}`,
        );

        console.log(
          `transfer=${transfer.providerTransferId}`,
        );

        console.log(
          `amount=${transfer.amountSatang}`,
        );

        console.log(
          `fee=${transfer.feeSatang}`,
        );

        console.log(
          `net=${transfer.netSatang}`,
        );

        console.log(
          "================================\n",
        );
      },
      120_000,
    );
  },
);
