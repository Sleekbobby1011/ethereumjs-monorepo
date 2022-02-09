import tape from 'tape'
import { BN } from 'ethereumjs-util'
import VM from '../../src'
import { DefaultStateManager } from '../../src/state'
import { AddOpcode } from '../../src/evm/types'
import { InterpreterStep, RunState } from '../../src/evm/interpreter'

const STOP = '00'
const JUMP = '56'
const JUMPDEST = '5b'
const PUSH1 = '60'

const testCases = [
  { code: [STOP, JUMPDEST, PUSH1, '05', JUMP, JUMPDEST], pc: 1, resultPC: 6 },
  {
    code: [STOP, JUMPDEST, PUSH1, '05', JUMP, JUMPDEST],
    pc: -1,
    error: 'Internal error: program counter not in range',
  },
  { code: [STOP], pc: 3, error: 'Internal error: program counter not in range' },
  { code: [STOP], resultPC: 1 },
]

tape('VM.runCode: initial program counter', (t) => {
  const vm = new VM()

  testCases.forEach((testData, i) => {
    t.test('should start the execution at the specified pc or 0 #' + i.toString(), async (st) => {
      const runCodeArgs = {
        code: Buffer.from(testData.code.join(''), 'hex'),
        pc: testData.pc,
        gasLimit: new BN(0xffff),
      }

      let err
      try {
        const result = await vm.runCode(runCodeArgs)
        if (testData.resultPC !== undefined) {
          t.equals(result.runState?.programCounter, testData.resultPC, 'runstate.programCounter')
        }
      } catch (e: any) {
        err = e
      }

      if (testData.error) {
        err = err ? err.message : 'no error thrown'
        st.equals(err, testData.error, 'error message should match')
        err = false
      }

      st.assert(!err)
      st.end()
    })
  })
})

tape('VM.runCode: interpreter', (t) => {
  t.test('should return a VmError as an exceptionError on the result', async (st) => {
    const vm = new VM()

    const INVALID_opcode = 'fe'
    const runCodeArgs = {
      code: Buffer.from(INVALID_opcode, 'hex'),
      gasLimit: new BN(0xffff),
    }

    let result: any
    try {
      result = await vm.runCode(runCodeArgs)
    } catch (e: any) {
      st.fail('should not throw error')
    }
    st.equal(result!.exceptionError!.errorType, 'VmError')
    st.ok(result!.exceptionError!.error.includes('invalid opcode'))
    st.end()
  })

  t.test('should throw on non-VmError', async (st) => {
    const stateManager = new DefaultStateManager()
    stateManager.putContractStorage = (..._args) => {
      throw new Error('Test')
    }
    const vm = new VM({ stateManager })

    const SSTORE = '55'
    const runCodeArgs = {
      code: Buffer.from([PUSH1, '01', PUSH1, '05', SSTORE].join(''), 'hex'),
      gasLimit: new BN(0xffff),
    }

    try {
      await vm.runCode(runCodeArgs)
      st.fail('should throw error')
    } catch (e: any) {
      st.ok(e.toString().includes('Test'), 'error thrown')
    }
    st.end()
  })
})

tape('VM: custom opcodes', (t) => {
  const fee = 333
  const logicFee = 33
  const totalFee = fee + logicFee
  const stackPush = 1

  const testOpcode: AddOpcode = {
    opcode: 0x21,
    opcodeName: 'TEST',
    baseFee: fee,
    gasFunction: function (runState: RunState, gas: BN) {
      gas.iaddn(logicFee)
    },
    logicFunction: function (runState: RunState) {
      runState.stack.push(new BN(stackPush))
    },
  }

  t.test('should add custom opcodes to the VM', async (st) => {
    const vm = new VM({
      customOpcodes: [testOpcode],
    })
    const gas = 123456
    let correctOpcodeName = false
    vm.on('step', (e: InterpreterStep) => {
      if (e.pc === 0) {
        correctOpcodeName = e.opcode.name === testOpcode.opcodeName
      }
    })
    const res = await vm.runCode({
      code: Buffer.from('21', 'hex'),
      gasLimit: new BN(gas),
    })
    st.ok(res.gasUsed.eqn(totalFee), 'succesfully charged correct gas')
    st.ok(res.runState!.stack._store[0].eqn(stackPush), 'succesfully ran opcode logic')
    st.ok(correctOpcodeName, 'succesfully set opcode name')
  })

  t.test('should delete opcodes from the VM', async (st) => {
    const vm = new VM({
      customOpcodes: [{ opcode: 0x20 }], // deletes KECCAK opcode
    })
    const gas = 123456
    const res = await vm.runCode({
      code: Buffer.from('20', 'hex'),
      gasLimit: new BN(gas),
    })
    st.ok(res.gasUsed.eqn(gas), 'succesfully deleted opcode')
  })

  t.test('should override opcodes in the VM', async (st) => {
    testOpcode.opcode = 0x20 // Overrides KECCAK
    const vm = new VM({
      customOpcodes: [testOpcode],
    })
    const gas = 123456
    const res = await vm.runCode({
      code: Buffer.from('20', 'hex'),
      gasLimit: new BN(gas),
    })
    st.ok(res.gasUsed.eqn(totalFee), 'succesfully charged correct gas')
    st.ok(res.runState!.stack._store[0].eqn(stackPush), 'succesfully ran opcode logic')
  })
})

tape('VM.runCode: RunCodeOptions', (t) => {
  t.test('should throw on negative value args', async (st) => {
    const vm = new VM()

    const runCodeArgs = {
      value: new BN('-10'),
    }

    try {
      await vm.runCode(runCodeArgs)
      st.fail('should not accept a negative call value')
    } catch (err: any) {
      st.ok(err.message.includes('value field cannot be negative'), 'throws on negative call value')
    }

    st.end()
  })
})
