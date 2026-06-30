import { Wallet } from 'ethers';
import { verifySignature } from './signature.service';

describe('verifySignature', () => {
  it('returns true when the signature matches the address', async () => {
    const wallet: import('ethers').HDNodeWallet = Wallet.createRandom();
    const message: 'hello world' = 'hello world';
    const signature: string = await wallet.signMessage(message);

    expect(verifySignature(wallet.address, message, signature)).toBe(true);
  });

  it('is case-insensitive for the address', async () => {
    const wallet: import('ethers').HDNodeWallet = Wallet.createRandom();
    const message: 'hello world' = 'hello world';
    const signature: string = await wallet.signMessage(message);

    expect(verifySignature(wallet.address.toLowerCase(), message, signature)).toBe(true);
  });

  it('returns false when the signature was made by a different wallet', async () => {
    const signer: import('ethers').HDNodeWallet = Wallet.createRandom();
    const other: import('ethers').HDNodeWallet = Wallet.createRandom();
    const message: 'hello world' = 'hello world';
    const signature: string = await signer.signMessage(message);

    expect(verifySignature(other.address, message, signature)).toBe(false);
  });

  it('returns false when the message was tampered with', async () => {
    const wallet: import('ethers').HDNodeWallet = Wallet.createRandom();
    const signature: string = await wallet.signMessage('original message');

    expect(verifySignature(wallet.address, 'tampered message', signature)).toBe(false);
  });

  it('returns false for a malformed signature instead of throwing', () => {
    expect(
      verifySignature('0x0000000000000000000000000000000000000000', 'msg', 'not-a-signature'),
    ).toBe(false);
  });
});
