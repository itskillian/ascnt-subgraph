import { log } from '@graphprotocol/graph-ts'

import { PoolInitialized as AscntInitializedEvent } from '../types/AscntDivHook/AscntDivHook'
import { Pool, PoolManager } from '../types/schema'
import { getSubgraphConfig, SubgraphConfig } from '../utils/chains'
import { ONE_BI } from '../utils/constants'

export function handleAscntInitialized(event: AscntInitializedEvent): void {
  handleAscntInitializedHelper(event)
}

export function handleAscntInitializedHelper(
  event: AscntInitializedEvent,
  subgraphConfig: SubgraphConfig = getSubgraphConfig(),
): void {
  const poolManagerAddress = subgraphConfig.poolManagerAddress
  const poolsToSkip = subgraphConfig.poolsToSkip
  const poolId = event.params.id.toHexString()

  if (poolsToSkip.includes(poolId)) {
    return
  }

  const pool = Pool.load(poolId)

  if (!pool) {
    log.warning('Pool not found: {}', [poolId])
    return
  }

  if (pool.isAscntPool) return

  pool.isAscntPool = true
  pool.save()

  const poolManager = PoolManager.load(poolManagerAddress)!
  const ascntPools = poolManager.ascntPools
  ascntPools.push(poolId)
  poolManager.ascntPools = ascntPools
  poolManager.ascntPoolCount = poolManager.ascntPoolCount.plus(ONE_BI)
  poolManager.save()
}
