import { CompilerConfig } from '@ton/blueprint';
import { readFileSync } from 'fs';
import { join } from 'path';

const base = join(__dirname, '..');

export const compile: CompilerConfig = {
  lang: 'func',
  targets: ['escrow.fc'],
  sources: (p: string) => readFileSync(join(base, p)).toString(),
};
