import { signPaymentRequest, verifyPaymentSignature } from '../paymentService';
import { faker } from '@faker-js/faker';

describe('Payment Service', () => {
  test('signPaymentRequest generates a valid HMAC signature', () => {
    const orderData = {
      orderId: faker.string.uuid(),
      amount: faker.number.int({ min: 1000, max: 1000000 }),
      description: faker.commerce.productDescription(),
    };

    const signature = signPaymentRequest(orderData);
    expect(signature).toBeDefined();
    expect(typeof signature).toBe('string');
    expect(signature.length).toBeGreaterThan(0);
  });

  test('verifyPaymentSignature returns true for valid signature', () => {
    const orderData = {
      orderId: 'ORDER123',
      amount: 50000,
    };
    const signature = signPaymentRequest(orderData);
    const isValid = verifyPaymentSignature(orderData, signature);
    expect(isValid).toBe(true);
  });

  test('verifyPaymentSignature returns false for tampered data', () => {
    const orderData = { orderId: 'ORDER123', amount: 50000 };
    const signature = signPaymentRequest(orderData);
    
    // Tamper with data
    const tamperedData = { orderId: 'ORDER123', amount: 99999 };
    const isValid = verifyPaymentSignature(tamperedData, signature);
    expect(isValid).toBe(false);
  });

  test('verifyPaymentSignature returns false for invalid signature', () => {
    const orderData = { orderId: 'ORDER123' };
    const isValid = verifyPaymentSignature(orderData, 'invalid_sig');
    expect(isValid).toBe(false);
  });
});
