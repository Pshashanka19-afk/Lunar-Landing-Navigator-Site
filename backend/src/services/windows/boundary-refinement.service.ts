export interface StateEvaluatorFn {
  (epochUtc: string): Promise<boolean>;
}

export class BoundaryRefinementService {
  /**
   * Refines a state transition time boundary between tStart (where state is true/false)
   * and tEnd (where state is opposite) using binary bisection down to toleranceSeconds.
   */
  public static async refineTransitionBoundary(
    startTimeUtc: string,
    endTimeUtc: string,
    evaluator: StateEvaluatorFn,
    toleranceSeconds = 30,
    maxIterations = 12
  ): Promise<string> {
    let tLow = new Date(startTimeUtc).getTime();
    let tHigh = new Date(endTimeUtc).getTime();

    if (tHigh < tLow) {
      const temp = tLow;
      tLow = tHigh;
      tHigh = temp;
    }

    const stateLow = await evaluator(new Date(tLow).toISOString());
    let iteration = 0;

    while (tHigh - tLow > toleranceSeconds * 1000 && iteration < maxIterations) {
      iteration++;
      const tMid = Math.round((tLow + tHigh) / 2);
      const stateMid = await evaluator(new Date(tMid).toISOString());

      if (stateMid === stateLow) {
        tLow = tMid;
      } else {
        tHigh = tMid;
      }
    }

    // Return the refined transition timestamp
    const refinedTimeMs = Math.round((tLow + tHigh) / 2);
    return new Date(refinedTimeMs).toISOString();
  }
}
