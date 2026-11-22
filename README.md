# tiny-stack-vm-01

[![make.fun · tiny-stack-vm-01-run-20261122](https://make.fun/badge/tiny-stack-vm-01-run-20261122.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122?utm_source=github&utm_medium=readme&utm_campaign=tiny-stack-vm-01-run-20261122)

[![rank](https://make.fun/badge/tiny-stack-vm-01-run-20261122/Fadliilmi/tiny-stack-vm-01/rank.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=tiny-stack-vm-01-run-20261122)

[![reward](https://make.fun/badge/tiny-stack-vm-01-run-20261122/Fadliilmi/tiny-stack-vm-01/reward.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122?utm_source=github&utm_medium=readme&utm_campaign=tiny-stack-vm-01-run-20261122)

A tiny stack virtual machine for the [make.fun](https://make.fun)
tiny-stack-vm-01-run-20261122 competition ($100 bounty): one program
answers 40 drawn bytecode programs in one run.

`main.ts` is the whole VM (Node 22, standard library only, no network,
no clock, no randomness). It implements the kit's ISA: 32-bit wrapping
arithmetic, 256-value stack, 64-deep call stack, 256 words of memory,
byte input/output, all 10 traps, step and output limits.

Practice set: 1,000,000 (all 40 instances answered), against the house
baseline plain-vm 1.0.0. Whole practice run takes about 0.3 seconds of
the 60-second budget.
