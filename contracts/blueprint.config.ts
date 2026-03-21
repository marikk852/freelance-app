import { Config } from '@ton/blueprint';

export const config: Config = {
  network: {
    endpoint: process.env.TON_ENDPOINT || 'https://testnet.toncenter.com/api/v2/',
    type: 'testnet',
    version: 'v2',
    key: process.env.TON_API_KEY || '',
  },
};
