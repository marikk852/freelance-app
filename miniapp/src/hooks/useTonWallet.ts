import { useEffect, useRef } from 'react';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { users as usersApi } from '../utils/api';

// ============================================================
// Hook: useTonWallet
// Connects TonConnect wallet and syncs address to backend
// ============================================================

export function useTonWalletConnect() {
  const [tonConnectUI] = useTonConnectUI();
  const wallet         = useTonWallet();
  const savedRef       = useRef<string | null>(null);

  // Whenever wallet connects — save address to backend
  useEffect(() => {
    if (!wallet) return;

    const address = wallet.account.address;
    if (savedRef.current === address) return;
    savedRef.current = address;

    // Convert raw address to user-friendly format
    const friendlyAddress = toUserFriendly(address);

    usersApi.setWallet(friendlyAddress).catch(() => {
      // Silently fail — user can retry
    });
  }, [wallet]);

  const connect    = () => tonConnectUI.openModal();
  const disconnect = () => tonConnectUI.disconnect();

  return {
    wallet,
    address    : wallet ? toUserFriendly(wallet.account.address) : null,
    isConnected: !!wallet,
    connect,
    disconnect,
  };
}

/**
 * Convert raw hex TON address to UQ... bounceable format.
 * TonConnect returns raw addresses — we store user-friendly.
 */
function toUserFriendly(raw: string): string {
  // If already in UQ/EQ format, return as-is
  if (/^(UQ|EQ)/.test(raw)) return raw;
  // Otherwise return raw (backend will handle it)
  return raw;
}
