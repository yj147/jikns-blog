"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Key } from "swr"
import type { FollowError } from "@/lib/interactions/follow-client"
import {
  applyFollowState,
  DEFAULT_FOLLOW_MUTATE_MATCHERS,
  normaliseFollowing,
  mapFollowServerError,
  mapFollowUnexpectedError,
  followSuccessMessage,
} from "@/lib/interactions/follow-client"
import { buildMutateTargets } from "@/lib/follow/cache-utils"
import type {
  MutateFn,
  ToastApi,
  ToggleFn,
  LoggerLike,
  UseFollowUserOptions,
  FollowHookDeps,
  FollowActionResult,
} from "@/lib/follow/types"

export type { UseFollowUserOptions, FollowActionResult }

export function createFollowUserHook({ toggle, mutate, toast, logger }: FollowHookDeps) {
  return function useFollowUser({
    mutateCacheKeys = [],
    mutateMatchers = [],
    optimistic = true,
    showToast = true,
    initialFollowing,
  }: UseFollowUserOptions = {}) {
    const initialList = useMemo(() => normaliseFollowing(initialFollowing), [initialFollowing])
    const initialFingerprint = useMemo(() => initialList.slice().sort().join("|"), [initialList])

    const [following, setFollowing] = useState<string[]>(initialList)
    const [error, setError] = useState<FollowError | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const isSubmittingRef = useRef(false)
    const inFlightPromiseRef = useRef<Promise<FollowActionResult> | null>(null)
    const inFlightUserRef = useRef<string | null>(null)
    const lastInitialFingerprintRef = useRef<string | null>(null)

    useEffect(() => {
      if (lastInitialFingerprintRef.current === initialFingerprint) return
      lastInitialFingerprintRef.current = initialFingerprint
      setFollowing(initialList)
    }, [initialFingerprint, initialList])

    const safeMutate = useCallback(
      (matcher: Key | ((key: Key) => boolean)) => {
        return mutate(matcher, undefined, { revalidate: true })
      },
      [mutate]
    )

    const refreshCaches = useCallback(async () => {
      const targets = buildMutateTargets(
        mutateCacheKeys,
        mutateMatchers,
        DEFAULT_FOLLOW_MUTATE_MATCHERS
      )
      await Promise.allSettled(targets.map(safeMutate))
    }, [mutateCacheKeys, mutateMatchers, safeMutate])

    const followingSet = useMemo(() => new Set(following), [following])

    const showToastIfNeeded = useCallback(
      (message: string | null, type: "success" | "error") => {
        if (!message) return
        const toastFn = type === "success" ? toast.success : toast.error
        toastFn(message)
      },
      [toast]
    )

    const refreshCachesIfNeeded = useCallback(
      (shouldRefresh: boolean) => {
        if (!shouldRefresh) return
        refreshCaches().catch((cacheError) => {
          logger.warn("刷新关注缓存失败", { error: cacheError })
        })
      },
      [logger, refreshCaches]
    )

    const commitFollowState = useCallback(
      (
        nextFollowing: string[],
        nextError: FollowError | null,
        toastMessage: string | null,
        toastType: "success" | "error",
        shouldRefreshCache: boolean
      ) => {
        // 直接同步更新状态,不使用 startTransition
        // startTransition 在测试环境中会导致 act() 无法正确等待状态更新完成
        setFollowing(nextFollowing)
        setError(nextError)

        showToastIfNeeded(toastMessage, toastType)
        refreshCachesIfNeeded(shouldRefreshCache)
      },
      [showToastIfNeeded, refreshCachesIfNeeded]
    )

    const buildNextFollowing = useCallback(
      (success: boolean, userId: string, follow: boolean, previousFollowing?: string[]) => {
        if (success) {
          return applyFollowState(following, userId, follow)
        }
        if (optimistic && previousFollowing) {
          return previousFollowing
        }
        return following
      },
      [following, optimistic]
    )

    const buildToastConfig = useCallback(
      (success: boolean, message?: string, error?: FollowError) => {
        if (!showToast) {
          return { message: null, type: "success" as const }
        }
        if (success) {
          return { message: message ?? null, type: "success" as const }
        }
        return { message: error?.message ?? null, type: "error" as const }
      },
      [showToast]
    )

    const handleFollowResult = useCallback(
      (
        success: boolean,
        userId: string,
        follow: boolean,
        message?: string,
        error?: FollowError,
        previousFollowing?: string[]
      ) => {
        const nextFollowing = buildNextFollowing(success, userId, follow, previousFollowing)
        const nextError = success ? null : (error ?? null)
        const { message: toastMessage, type: toastType } = buildToastConfig(success, message, error)

        commitFollowState(nextFollowing, nextError, toastMessage, toastType, success)
      },
      [buildNextFollowing, buildToastConfig, commitFollowState]
    )

    const createValidationError = useCallback((userId: string): FollowError | null => {
      if (!userId) {
        return {
          code: "VALIDATION_ERROR",
          message: "用户ID不能为空",
        }
      }
      return null
    }, [])

    const applyOptimisticUpdate = useCallback(
      (userId: string, follow: boolean) => {
        const previousFollowing = following
        if (optimistic) {
          setFollowing((prev) => applyFollowState(prev, userId, follow))
        }
        setError(null)
        return previousFollowing
      },
      [following, optimistic]
    )

    const processSuccess = useCallback(
      (userId: string, follow: boolean, message?: string) => {
        const successMessage = followSuccessMessage(follow, message)
        handleFollowResult(true, userId, follow, successMessage)
        return { success: true } as const
      },
      [handleFollowResult]
    )

    const processServerError = useCallback(
      (userId: string, follow: boolean, error: any, previousFollowing: string[]) => {
        const mapped = mapFollowServerError(error ?? {}, follow)
        handleFollowResult(false, userId, follow, undefined, mapped, previousFollowing)
        return { success: false, error: mapped } as const
      },
      [handleFollowResult]
    )

    const processUnexpectedError = useCallback(
      (userId: string, follow: boolean, error: any, previousFollowing: string[]) => {
        const mapped = mapFollowUnexpectedError(error, follow)
        handleFollowResult(false, userId, follow, undefined, mapped, previousFollowing)
        logger.error("关注操作异常", { error })
        return { success: false, error: mapped } as const
      },
      [handleFollowResult, logger]
    )

    const executeAction = useCallback(
      (userId: string, follow: boolean): Promise<FollowActionResult> => {
        if (isSubmittingRef.current) {
          if (inFlightPromiseRef.current && inFlightUserRef.current === userId) {
            return inFlightPromiseRef.current
          }

          const busyError: FollowError = {
            code: "BUSY",
            message: "关注操作处理中",
          }
          setError(busyError)
          return Promise.resolve({ success: false, error: busyError })
        }

        const validationError = createValidationError(userId)
        if (validationError) {
          setError(validationError)
          return Promise.resolve({ success: false, error: validationError })
        }

        isSubmittingRef.current = true
        inFlightUserRef.current = userId
        setIsSubmitting(true)

        const actionPromise = (async (): Promise<FollowActionResult> => {
          const previousFollowing = applyOptimisticUpdate(userId, follow)

          try {
            const response = await toggle(userId, follow)
            if (response.success) return processSuccess(userId, follow, response.message)
            return processServerError(userId, follow, response.error, previousFollowing)
          } catch (unexpected) {
            return processUnexpectedError(userId, follow, unexpected, previousFollowing)
          } finally {
            isSubmittingRef.current = false
            inFlightPromiseRef.current = null
            inFlightUserRef.current = null
            setIsSubmitting(false)
          }
        })()

        inFlightPromiseRef.current = actionPromise
        return actionPromise
      },
      [
        createValidationError,
        applyOptimisticUpdate,
        processSuccess,
        processServerError,
        processUnexpectedError,
        toggle,
      ]
    )

    const followUser = useCallback((userId: string) => executeAction(userId, true), [executeAction])

    const unfollowUser = useCallback(
      (userId: string) => executeAction(userId, false),
      [executeAction]
    )

    const toggleFollow = useCallback(
      (userId: string, currentlyFollowing: boolean) => executeAction(userId, !currentlyFollowing),
      [executeAction]
    )

    const isFollowing = useCallback((userId: string) => followingSet.has(userId), [followingSet])

    const clearError = useCallback(() => setError(null), [])

    return {
      followUser,
      unfollowUser,
      toggleFollow,
      isFollowing,
      isLoading: isSubmitting,
      error,
      clearError,
      followingUsers: followingSet,
    }
  }
}
