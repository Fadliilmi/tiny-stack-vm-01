// Tiny stack VM (make.fun tiny-stack-vm-01). Implements ISA.md v1 from scratch:
// 32-bit wrapping ints, 256-value data stack, 64-deep call stack, 256 words
// of memory, byte I/O, 10 traps, step/output limits. Node 22, builtins only,
// deterministic: no clock, env, or randomness.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const IN = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
// Values popped by each opcode (index = opcode); invalid opcodes never reach here.
const NEED = '000112230000000022222221222122202220000000000000011000000000000012000000000000001101';

function run(prog: Buffer, inp: Buffer): [number[], number] {
  const st = new Int32Array(256), cs = new Int32Array(64), mem = new Int32Array(256);
  const out: number[] = [];
  let sp = 0, cp = 0, pc = 0, ip = 0, steps = 0;
  for (;;) {
    if (steps >= 1000000) return [out, 10]; // step limit
    if (pc < 0 || pc >= prog.length) return [out, 9]; // pc outside program
    const op = prog[pc];
    if (!(op < 8 || (op > 15 && op < 35) || (op > 47 && op < 53)
      || (op > 63 && op < 66) || (op > 79 && op < 84))) return [out, 5]; // unknown opcode
    const il = op === 1 ? 1 : op === 2 ? 4 : op >= 0x30 && op <= 0x33 ? 2 : 0;
    if (pc + 1 + il > prog.length) return [out, 9]; // immediate cut off
    const need = NEED.charCodeAt(op) - 48;
    if (sp < need) return [out, 2]; // stack underflow
    // Only PUSH8/PUSH32/IN grow the stack (net +1); DUP/OVER never overflow.
    if (sp >= 256 && (op === 1 || op === 2 || op === 0x52)) return [out, 3];
    steps++;
    switch (op) {
      case 0x00: return [out, 0];
      case 0x01: st[sp++] = (prog[pc + 1] << 24) >> 24; pc += 2; break; // PUSH8 sign-extended
      case 0x02: st[sp++] = prog[pc + 1] | prog[pc + 2] << 8 | prog[pc + 3] << 16 | prog[pc + 4] << 24; pc += 5; break; // PUSH32 LE
      case 0x03: sp--; pc++; break;
      case 0x04: st[sp] = st[sp - 1]; sp++; pc++; break; // DUP
      case 0x05: { const t = st[sp - 1]; st[sp - 1] = st[sp - 2]; st[sp - 2] = t; pc++; break; } // SWAP
      case 0x06: st[sp] = st[sp - 2]; sp++; pc++; break; // OVER
      case 0x07: { const t = st[sp - 3]; st[sp - 3] = st[sp - 2]; st[sp - 2] = st[sp - 1]; st[sp - 1] = t; pc++; break; } // ROT
      case 0x10: st[sp - 2] = st[sp - 2] + st[sp - 1] | 0; sp--; pc++; break; // ADD
      case 0x11: st[sp - 2] = st[sp - 2] - st[sp - 1] | 0; sp--; pc++; break; // SUB
      case 0x12: st[sp - 2] = Math.imul(st[sp - 2], st[sp - 1]); sp--; pc++; break; // MUL low 32 bits
      case 0x13: { const a = st[sp - 2], b = st[sp - 1]; if (!b) return [out, 4]; st[sp - 2] = a / b | 0; sp--; pc++; break; } // DIV
      case 0x14: { const a = st[sp - 2], b = st[sp - 1]; if (!b) return [out, 4]; st[sp - 2] = a % b | 0; sp--; pc++; break; } // MOD
      case 0x15: { const a = st[sp - 2] >>> 0, b = st[sp - 1] >>> 0; if (!b) return [out, 4]; st[sp - 2] = a / b | 0; sp--; pc++; break; } // DIVU
      case 0x16: { const a = st[sp - 2] >>> 0, b = st[sp - 1] >>> 0; if (!b) return [out, 4]; st[sp - 2] = a % b | 0; sp--; pc++; break; } // MODU
      case 0x17: st[sp - 1] = -st[sp - 1] | 0; pc++; break; // NEG
      case 0x18: st[sp - 2] &= st[sp - 1]; sp--; pc++; break; // AND
      case 0x19: st[sp - 2] |= st[sp - 1]; sp--; pc++; break; // OR
      case 0x1a: st[sp - 2] ^= st[sp - 1]; sp--; pc++; break; // XOR
      case 0x1b: st[sp - 1] = ~st[sp - 1]; pc++; break; // NOT
      case 0x1c: st[sp - 2] <<= st[sp - 1] & 31; sp--; pc++; break; // SHL
      case 0x1d: st[sp - 2] >>= st[sp - 1] & 31; sp--; pc++; break; // SHR
      case 0x1e: st[sp - 2] = st[sp - 2] >>> (st[sp - 1] & 31) | 0; sp--; pc++; break; // SHRU
      case 0x20: st[sp - 2] = st[sp - 2] === st[sp - 1] ? 1 : 0; sp--; pc++; break; // EQ
      case 0x21: st[sp - 2] = st[sp - 2] < st[sp - 1] ? 1 : 0; sp--; pc++; break; // LT
      case 0x22: st[sp - 2] = (st[sp - 2] >>> 0) < (st[sp - 1] >>> 0) ? 1 : 0; sp--; pc++; break; // LTU
      case 0x30: case 0x31: case 0x32: { // JMP/JZ/JNZ, signed 16-bit offset
        let off = prog[pc + 1] | prog[pc + 2] << 8;
        if (off & 0x8000) off -= 0x10000;
        const nx = pc + 3;
        if (op === 0x30) pc = nx + off;
        else pc = (op === 0x31 ? st[--sp] === 0 : st[--sp] !== 0) ? nx + off : nx;
        break;
      }
      case 0x33: if (cp >= 64) return [out, 7]; cs[cp++] = pc + 3; pc = prog[pc + 1] | prog[pc + 2] << 8; break; // CALL
      case 0x34: if (!cp) return [out, 8]; pc = cs[--cp]; break; // RET
      case 0x40: { const a = st[sp - 1]; if (a < 0 || a > 255) return [out, 6]; st[sp - 1] = mem[a]; pc++; break; } // LOAD
      case 0x41: { const a = st[sp - 1]; if (a < 0 || a > 255) return [out, 6]; mem[a] = st[sp - 2]; sp -= 2; pc++; break; } // STORE
      case 0x50: { const s = String(st[--sp]); if (out.length + s.length > 65536) return [out, 11]; for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i)); pc++; break; } // PRINT
      case 0x51: if (out.length >= 65536) return [out, 11]; out.push(st[--sp] & 255); pc++; break; // PUTC
      case 0x52: st[sp++] = ip < inp.length ? inp[ip++] : -1; pc++; break; // IN
      case 0x53: return [out, st[--sp] & 255]; // EXIT, low byte
    }
  }
}

for (const id of readdirSync(IN).sort()) {
  const d = join(IN, id);
  const prog = readFileSync(join(d, 'program.bin'));
  let inp: Buffer;
  try { inp = readFileSync(join(d, 'input.bin')); } catch { inp = Buffer.alloc(0); }
  const [out, code] = run(prog, inp);
  const od = join(OUT, id);
  mkdirSync(od, { recursive: true });
  writeFileSync(join(od, 'stdout.bin'), Buffer.from(out));
  writeFileSync(join(od, 'exit.txt'), code + '\n');
}
