"use client";

import { cn } from "@/lib/utils";
import {
  accountStatusWord,
  accountToneClass,
  moneyTry,
} from "@/lib/party-account";

export function PartyBalanceAmount({ balance }: { balance: number }) {
  return (
    <span
      className={cn(
        "block whitespace-nowrap tabular-nums font-semibold",
        accountToneClass(balance)
      )}
    >
      {Math.abs(balance) <= 0.009 ? "0,00 ₺" : moneyTry(Math.abs(balance))}
    </span>
  );
}

export function PartyBalanceStatus({ balance }: { balance: number }) {
  return (
    <span className={cn("block whitespace-nowrap font-medium", accountToneClass(balance))}>
      {accountStatusWord(balance)}
    </span>
  );
}
