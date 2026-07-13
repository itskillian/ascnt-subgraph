import { BigInt, log } from '@graphprotocol/graph-ts'

import { BeforeSwap as AscntBeforeSwapEvent } from '../types/AscntDivHook/AscntDivHook'
import { Pool, SwapStaging } from '../types/schema'
import { loadTransaction } from '../utils/index'

export function handleAscntBeforeSwap(event: AscntBeforeSwapEvent): void {
  handleAscntBeforeSwapHelper(event)
}

export function handleAscntBeforeSwapHelper(event: AscntBeforeSwapEvent): void {
  const poolId = event.params.poolId.toHexString()
  const pool = Pool.load(poolId)

  if (!pool) {
    log.warning('Pool not found: {}', [poolId])
    return
  }

  // SimHookMVP's BeforeSwap.priceImpact is the pre-swap simulated impact — map it
  // onto estimatedPriceImpact so the estimated-vs-real error metric keeps working.
  pool.sqrtPriceX96Before = event.params.sqrtPriceX96Before
  pool.estimatedPriceImpact = event.params.priceImpact
  pool.decayedCumPriceImpact = event.params.decayedCumPriceImpact
  pool.dynamicFeePips = BigInt.fromI32(event.params.dynamicFeePips)

  // create Swap Staging event
  const transaction = loadTransaction(event)
  const swapStaging = new SwapStaging(transaction.id + '-' + pool.id.toString())
  swapStaging.transaction = transaction.id
  swapStaging.pool = pool.id
  swapStaging.sqrtPriceX96Before = event.params.sqrtPriceX96Before
  swapStaging.estimatedPriceImpact = event.params.priceImpact
  swapStaging.decayedCumPriceImpact = event.params.decayedCumPriceImpact
  swapStaging.dynamicFeePips = BigInt.fromI32(event.params.dynamicFeePips)

  pool.save()
  swapStaging.save()
}
