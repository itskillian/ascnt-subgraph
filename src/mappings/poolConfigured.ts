import { BigInt, log } from '@graphprotocol/graph-ts'

import { PoolConfigured as PoolConfiguredEvent } from '../types/AscntDivHook/AscntDivHook'
import { Pool } from '../types/schema'

export function handlePoolConfigured(event: PoolConfiguredEvent): void {
  handlePoolConfiguredHelper(event)
}

export function handlePoolConfiguredHelper(event: PoolConfiguredEvent): void {
  const poolId = event.params.poolId.toHexString()
  const pool = Pool.load(poolId)

  if (!pool) {
    log.warning('Pool not found: {}', [poolId])
    return
  }

  pool.configured = event.params.configured
  pool.minFee = BigInt.fromI32(event.params.minFee)
  pool.maxFee = BigInt.fromI32(event.params.maxFee)
  pool.fallbackFee = BigInt.fromI32(event.params.fallbackFee)
  pool.timeDecayLength = event.params.timeDecayLength
  pool.illiqScale = event.params.illiqScale

  pool.save()
}
