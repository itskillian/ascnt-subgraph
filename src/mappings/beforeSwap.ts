import { BigInt, log } from '@graphprotocol/graph-ts'

import { BeforeSwap as BeforeSwapEvent } from '../types/AscntDivHook/AscntDivHook'
import { Pool, SwapStaging } from '../types/schema'
import { loadTransaction } from '../utils/index'

export function handleBeforeSwap(event: BeforeSwapEvent): void {
  handleBeforeSwapHelper(event)
}

export function handleBeforeSwapHelper(event: BeforeSwapEvent): void {
  const poolId = event.params.poolId.toHexString()
  const pool = Pool.load(poolId)

  if (!pool) {
    log.warning('Pool not found: {}', [poolId])
    return
  }

  pool.sqrtPriceX96Before = event.params.sqrtPriceX96before
  pool.illiqBefore = event.params.illiqBefore
  pool.estimatedVolume1 = event.params.estimatedVolume1
  pool.estimatedPriceImpact = event.params.estimatedPriceImpact
  pool.decayedCumPriceImpact = event.params.decayedCumPriceImpact
  pool.dynamicFeePips = BigInt.fromI32(event.params.dynamicFeePips)

  // create Swap Staging event
  const transaction = loadTransaction(event)
  const swapStaging = new SwapStaging(transaction.id + '-' + pool.id.toString())
  swapStaging.transaction = transaction.id
  swapStaging.pool = pool.id
  swapStaging.sqrtPriceX96Before = event.params.sqrtPriceX96before
  swapStaging.illiqBefore = event.params.illiqBefore
  swapStaging.estimatedVolume1 = event.params.estimatedVolume1
  swapStaging.estimatedPriceImpact = event.params.estimatedPriceImpact
  swapStaging.decayedCumPriceImpact = event.params.decayedCumPriceImpact
  swapStaging.dynamicFeePips = BigInt.fromI32(event.params.dynamicFeePips)

  pool.save()
  swapStaging.save()
}
