import { randomInt } from "node:crypto";

// Bỏ 0/O/o và 1/l/I để người nhận đọc hoặc gõ lại link không bị nhầm
const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const LENGTH = 8;
const PATTERN = new RegExp(`^[${ALPHABET}]{${LENGTH}}$`);

export function generateShareCode(): string {
  let code = "";
  for (let index = 0; index < LENGTH; index++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

/** Chặn sớm chuỗi rác trên URL trước khi hỏi DB */
export function isShareCode(value: string): boolean {
  return PATTERN.test(value);
}
