import Dexie, { type EntityTable } from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import { addToSyncQueue } from './sync';

export interface WaterServiceRecord {
  id: string; // uuid
  customer_name: string;
  price: number;
  status: 'PENDING' | 'CONFIRMED' | 'PAID' | 'CLOSED';
  created_at: number;
  updated_at: number;
  delivery_code: string; 
  payment_code?: string;
  delivery: {
    provider_signed: boolean;
    customer_signed: boolean;
  };
  payment: {
    provider_signed: boolean;
    customer_signed: boolean;
  };
}

const db = new Dexie('WaterServiceDB') as Dexie & {
  records: EntityTable<WaterServiceRecord, 'id'>;
};

db.version(1).stores({
  records: 'id, status, created_at, delivery_code, payment_code'
});

export { db };

// Helper to generate 6-digit code
export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createRecord(customer_name: string, price: number = 5000) {
  const record: WaterServiceRecord = {
    id: uuidv4(),
    customer_name,
    price,
    status: 'PENDING',
    created_at: Date.now(),
    updated_at: Date.now(),
    delivery_code: generateCode(),
    delivery: {
      provider_signed: true,
      customer_signed: false
    },
    payment: {
      provider_signed: false,
      customer_signed: false
    }
  };
  await db.records.add(record);
  addToSyncQueue(record.id);
  return record;
}

export async function confirmDelivery(code: string) {
  const records = await db.records.where('delivery_code').equals(code).toArray();
  const pendingRecord = records.find(r => r.status === 'PENDING');
  if (pendingRecord) {
    await db.records.update(pendingRecord.id, {
      status: 'CONFIRMED',
      updated_at: Date.now(),
      'delivery.customer_signed': true
    });
    addToSyncQueue(pendingRecord.id);
    return { success: true, record: pendingRecord };
  }
  return { success: false };
}

export async function deletePendingRecord(id: string) {
  const record = await db.records.get(id);
  if (record && record.status === 'PENDING') {
    await db.records.delete(id);
    return true;
  }
  return false;
}

export async function createPaymentCode(recordIds: string[]) {
    const code = generateCode();
    await db.transaction('rw', db.records, async () => {
      for (const id of recordIds) {
          await db.records.update(id, {
              payment_code: code,
              updated_at: Date.now(),
              'payment.provider_signed': true
          });
          addToSyncQueue(id);
      }
    });
    return code;
}

export async function cancelPaymentRequest(code: string) {
  const records = await db.records.where('payment_code').equals(code).toArray();
  const unconfirmedPayments = records.filter(r => r.status === 'CONFIRMED');
  
  if (unconfirmedPayments.length > 0) {
    await db.transaction('rw', db.records, async () => {
      for (const record of unconfirmedPayments) {
          await db.records.update(record.id, {
              payment_code: undefined,
              updated_at: Date.now(),
              'payment.provider_signed': false
          });
          addToSyncQueue(record.id);
      }
    });
    return true;
  }
  return false;
}

export async function confirmPayment(code: string) {
    const records = await db.records.where('payment_code').equals(code).toArray();
    const confirmedRecords = records.filter(r => r.status === 'CONFIRMED');
    
    if (confirmedRecords.length > 0) {
      await db.transaction('rw', db.records, async () => {
        for (const record of confirmedRecords) {
            await db.records.update(record.id, {
                status: 'PAID',
                updated_at: Date.now(),
                'payment.customer_signed': true
            });
            addToSyncQueue(record.id);
        }
      });
      return { success: true, count: confirmedRecords.length, total: confirmedRecords.reduce((sum, r) => sum + r.price, 0) };
    }
    return { success: false };
}
