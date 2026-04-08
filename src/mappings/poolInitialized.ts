import { PoolInitialized as PoolInitializedEvent } from '../types/AscntDivHook/AscntDivHook'
import { PoolManager } from '../types/schema'
import { getSubgraphConfig, SubgraphConfig } from '../utils/chains'
import { ONE_BI } from '../utils/constants'

export function handlePoolInitialized(event: PoolInitializedEvent): void {
  handlePoolInitializedHelper(event)
}

export function handlePoolInitializedHelper(
  event: PoolInitializedEvent,
  subgraphConfig: SubgraphConfig = getSubgraphConfig(),
): void {
  const poolManagerAddress = subgraphConfig.poolManagerAddress
  const poolsToSkip = subgraphConfig.poolsToSkip
  const poolId = event.params.id.toHexString()

  if (poolsToSkip.includes(poolId)) {
    return
  }

  const poolManager = PoolManager.load(poolManagerAddress)!
  const pools = poolManager.ascntPools
  pools.push(poolId)
  poolManager.ascntPools = pools
  poolManager.ascntPoolCount = poolManager.ascntPoolCount.plus(ONE_BI)
  poolManager.save()
}
