import { BigDecimal, BigInt, ethereum } from '@graphprotocol/graph-ts'
import { afterEach, assert, beforeEach, clearStore, describe, newMockEvent, test } from 'matchstick-as'

import { Pool } from '../../src/types/schema'
import { updatePoolDayData, updatePoolHourData } from '../../src/utils/intervalUpdates'
import { createAndStoreTestPool, USDC_WETH_05_MAINNET_POOL_FIXTURE, USDC_WETH_POOL_ID } from '../handlers/constants'

// Fixed timestamp so both events fall in the same hour/day bucket (i.e. the same
// PoolHourData / PoolDayData entity).
const TS = 1600000000
const HOUR_ID = TS / 3600
const DAY_ID = TS / 86400
const RADIX = BigInt.fromString('4294967296') // 2^32

const PEG = BigDecimal.fromString('1') // victim swap leaves the pool on peg
const DEPEG = BigDecimal.fromString('0.5') // MEV swap pushes token0 off peg

// Build an event at a specific (blockNumber, logIndex) but a fixed bucket timestamp.
function eventAt(blockNumber: i32, logIndex: i32): ethereum.Event {
  const e = newMockEvent()
  e.block.number = BigInt.fromI32(blockNumber)
  e.block.timestamp = BigInt.fromI32(TS)
  e.logIndex = BigInt.fromI32(logIndex)
  return e
}

function ordinal(blockNumber: i32, logIndex: i32): string {
  return BigInt.fromI32(blockNumber)
    .times(RADIX)
    .plus(BigInt.fromI32(logIndex))
    .toString()
}

// Set the pool's current price then run the interval updates, mirroring what the
// swap handler does (price is written to the Pool before the candle is updated).
function priceThenUpdate(price: BigDecimal, event: ethereum.Event): void {
  const pool = Pool.load(USDC_WETH_POOL_ID)!
  pool.token0Price = price
  pool.save()
  updatePoolDayData(USDC_WETH_POOL_ID, event)
  updatePoolHourData(USDC_WETH_POOL_ID, event)
}

describe('interval close ordering (intra-block depeg)', () => {
  beforeEach(() => {
    createAndStoreTestPool(USDC_WETH_05_MAINNET_POOL_FIXTURE)
  })

  afterEach(() => {
    clearStore()
  })

  test('an out-of-order earlier depeg swap does not overwrite the later victim close', () => {
    const hourEntity = USDC_WETH_POOL_ID + '-' + HOUR_ID.toString()
    const dayEntity = USDC_WETH_POOL_ID + '-' + DAY_ID.toString()

    // 1) Victim swap has the higher log position (executes last on-chain); peg holds.
    priceThenUpdate(PEG, eventAt(100, 10))
    // 2) The earlier MEV/depeg swap (lower log position) is processed out of order.
    priceThenUpdate(DEPEG, eventAt(100, 5))

    // close must reflect the victim (highest-ordinal) swap, not the depeg.
    assert.fieldEquals('PoolHourData', hourEntity, 'close', PEG.toString())
    assert.fieldEquals('PoolDayData', dayEntity, 'close', PEG.toString())
    // ...while the depeg is still preserved as the low wick.
    assert.fieldEquals('PoolHourData', hourEntity, 'low', DEPEG.toString())
    assert.fieldEquals('PoolDayData', dayEntity, 'low', DEPEG.toString())
    // and the guard recorded the victim's ordinal.
    assert.fieldEquals('PoolHourData', hourEntity, 'closeOrdinal', ordinal(100, 10))
    assert.fieldEquals('PoolDayData', dayEntity, 'closeOrdinal', ordinal(100, 10))
  })

  test('in-order swaps still advance the close normally', () => {
    const hourEntity = USDC_WETH_POOL_ID + '-' + HOUR_ID.toString()

    // Depeg first (lower ordinal), victim second (higher ordinal) — the newest wins.
    priceThenUpdate(DEPEG, eventAt(100, 5))
    priceThenUpdate(PEG, eventAt(100, 10))

    assert.fieldEquals('PoolHourData', hourEntity, 'close', PEG.toString())
    assert.fieldEquals('PoolHourData', hourEntity, 'low', DEPEG.toString())
    assert.fieldEquals('PoolHourData', hourEntity, 'closeOrdinal', ordinal(100, 10))
  })

  test('a later-block event in the same hour advances the close', () => {
    const hourEntity = USDC_WETH_POOL_ID + '-' + HOUR_ID.toString()

    // Same hour bucket, but a later block — ordinal must order across blocks too.
    priceThenUpdate(PEG, eventAt(100, 900))
    priceThenUpdate(DEPEG, eventAt(101, 1))

    assert.fieldEquals('PoolHourData', hourEntity, 'close', DEPEG.toString())
    assert.fieldEquals('PoolHourData', hourEntity, 'closeOrdinal', ordinal(101, 1))
  })
})
