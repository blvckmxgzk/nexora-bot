# NEXORA Production Runbook

## Deployment model

NEXORA ต้องรันเป็น long-running process/container เพราะมี:

- Discord Gateway connection
- Payment expiration worker
- Payout reconciliation worker
- Dispute reconciliation worker
- Notification delivery worker
- Marketplace operations monitor

ห้ามใช้ deployment ที่ freeze/terminate process หลัง request จบ

## Required launch checks

ก่อนเปิดให้ผู้ใช้จริง:

1. `npm ci`
2. `npm run build`
3. รัน Marketplace test suite ทั้งหมด
4. ตั้ง `NODE_ENV=production`
5. ใช้ HTTPS public API URL
6. ตรวจว่า `/api/v1/health` = 200
7. ตรวจว่า `/api/v1/ready` = 200
8. รัน `npm run prelive:audit`
9. Audit ต้องแสดง `"ready": true`
10. `/ops-status summary` ต้องไม่มี critical operational issue
11. `/ops-status alerts` ต้องไม่มี unresolved customer-impact alert

## Omise / Opn safety

NEXORA ยังอยู่ Test Mode

ห้ามเปลี่ยน:

- `skey_test_*`
- `pkey_test_*`

เป็น Live key จนกว่าจะมี provider/business approval ที่เกี่ยวข้องครบ

การมี Recipient / Transfer API ใช้งานได้
ไม่ได้แปลว่าได้รับอนุญาตให้ทำ marketplace/payment-facilitator model อัตโนมัติ

## Customer transaction trust

ลูกค้าใช้:

`/transaction-status`

เพื่อตรวจ:

- Order status
- Payment status
- Refund status
- Notification delivery state

คำสั่งต้องตรวจ ownership ก่อนแสดงข้อมูล

ห้ามแสดง:

- Provider secret
- Provider transaction internals
- Risk score
- Fraud signals
- Internal metadata

## Notification incidents

ถ้ามี `notification_dead_letter`:

1. เปิด `/ops-status alerts`
2. ตรวจ Delivery ID
3. ให้ผู้ใช้เปิดรับ Discord DM หากจำเป็น
4. ใช้ `/ops-status retry-notification`
5. ตรวจว่า status กลายเป็น `sent`
6. Alert ต้อง resolve หลังส่งสำเร็จ

## MongoDB backup

ก่อนเปิดเงินจริง ต้องมี backup ที่อยู่นอก application process

ขั้นต่ำ:

- เปิด backup/snapshot ของ MongoDB deployment
- กำหนด retention policy
- จำกัดสิทธิ์ database credentials
- เก็บ credentials ใน secret manager ของ hosting platform
- ห้าม commit `.env`
- ทดสอบ restore ไปยัง database แยกจาก production

## Restore drill

การมี backup อย่างเดียวไม่พอ

ก่อนเงินจริง:

1. สร้าง backup/snapshot
2. Restore ลง database ชั่วคราว
3. รัน consistency checks
4. ตรวจ Order / Payment / Refund / Ledger / Payout / Dispute
5. ตรวจ unique indexes
6. ตรวจ SellerFinancialState
7. ลบ temporary restore หลังตรวจเสร็จอย่างปลอดภัย

บันทึกวันที่ restore drill ล่าสุดไว้ใน operational records

## Incident response

ถ้า financial state ผิดปกติ:

- อย่าลบ ledger entry
- อย่าแก้ Provider state ด้วยมือ
- หยุด payout หากจำเป็น
- ตรวจ `/ops-status`
- ตรวจ Financial Health
- ตรวจ Pre-Live / Final Audit
- ใช้ immutable adjustment/recovery flow ที่ระบบรองรับ

## Deployment rollback

ถ้า release ใหม่ผิดปกติ:

1. หยุดรับ deployment ใหม่
2. rollback container/image ไป version ก่อนหน้า
3. อย่า rollback MongoDB ด้วยการลบข้อมูลล่าสุด
4. ให้ reconciliation workers ตรวจ Provider state หลังระบบกลับมา
5. ตรวจ payout/refund/dispute/webhook ที่เกิดระหว่าง incident

## Live-money gate

การผ่าน unit/integration tests ไม่ใช่ Live-money approval

ก่อนรับเงินจริงยังต้องมี:

- Omise/Opn approval ที่ตรงกับ business model
- KYB/KYC ตามที่เกี่ยวข้อง
- business/legal/commercial approval
- production secret management
- backup + restore drill
- monitoring/alert destination ที่มีคนรับผิดชอบ
- controlled rollout
