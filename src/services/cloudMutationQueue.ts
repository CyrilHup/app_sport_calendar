export type CloudMutationDomain =
  | 'activities'
  | 'wellness'
  | 'manualPairs'
  | 'adaptiveOverrides'
  | 'postponeOverrides';

/** Serializes cloud writes and reports both rejected promises and false results. */
export function createCloudMutationQueue(
  onResult: (domain: CloudMutationDomain, success: boolean, error?: unknown) => void
) {
  let tail: Promise<unknown> = Promise.resolve();

  return {
    enqueue(domain: CloudMutationDomain, mutation: () => Promise<boolean>): Promise<boolean> {
      const result = tail.then(async () => {
        try {
          const success = await mutation();
          onResult(domain, success);
          return success;
        } catch (error) {
          onResult(domain, false, error);
          return false;
        }
      });
      tail = result;
      return result;
    }
  };
}
