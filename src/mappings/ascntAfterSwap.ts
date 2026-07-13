import { BigInt, log, store } from '@graphprotocol/graph-ts'

import { AfterSwap as AscntAfterSwapEvent } from '../types/AscntDivHook/AscntDivHook'
import { Pool, Swap, SwapStaging } from '../types/schema'
import { loadTransaction } from '../utils/index'
import { updateDynamicFeeAggregates } from '../utils/intervalUpdates'

const WAD = BigInt.fromString('1000000000000000000')

/** |estimated - real| * WAD / real; null if estimate missing or real is zero with non-zero estimate. */
export function priceImpactRelativeErrorWad(estimated: BigInt | null, real: BigInt): BigInt | null {
  if (estimated === null) {
    return null
  }
  if (real.equals(BigInt.zero())) {
    return estimated.equals(BigInt.zero()) ? BigInt.zero() : null
  }
  const diff = estimated.gt(real) ? estimated.minus(real) : real.minus(estimated)
  return diff.times(WAD).div(real)
}

export function handleAscntAfterSwap(event: AscntAfterSwapEvent): void {
  handleAscntAfterSwapHelper(event)
}

export function handleAscntAfterSwapHelper(event: AscntAfterSwapEvent): void {
  const poolId = event.params.poolId.toHexString()
  const pool = Pool.load(poolId)

  if (!pool) {
    log.warning('Pool not found: {}', [poolId])
    return
  }

  // pair with previous Swap Event
  const transaction = loadTransaction(event)
  const swapStagingId = transaction.id + '-' + poolId
  const swapStaging = SwapStaging.load(swapStagingId)

  if (!swapStaging) {
    log.warning('SwapStaging not found: {}', [swapStagingId])
    return
  }

  if (swapStaging.swapId === null) {
    log.warning('SwapStaging missing swapId: {}', [swapStagingId])
    return
  }
  const swapId = swapStaging.swapId as string
  const swap = Swap.load(swapId)

  if (!swap) {
    log.warning('Swap not found: {}', [swapId])
    return
  }

  store.remove('SwapStaging', swapStagingId)

  const realPriceImpact = event.params.priceImpact
  const priceImpactError = priceImpactRelativeErrorWad(swap.estimatedPriceImpact, realPriceImpact)

  swap.priceImpact = realPriceImpact
  swap.cumPriceImpact = event.params.cumPriceImpact
  swap.priceImpactError = priceImpactError

  pool.priceImpact = realPriceImpact
  pool.cumPriceImpact = event.params.cumPriceImpact
  pool.priceImpactError = priceImpactError

  swap.save()
  pool.save()

  // Roll the per-period dynamic-fee aggregates. dynamicFeePips was merged onto
  // the Swap entity by handleSwap from SwapStaging — it should be set for any
  // Ascnt-pool swap, but guard defensively.
  const fee = swap.dynamicFeePips
  if (fee !== null) {
    updateDynamicFeeAggregates(poolId, event.block.timestamp.toI32(), fee as BigInt, swap.id)
  }
}
