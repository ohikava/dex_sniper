export function isEmpty(obj: object): boolean {
    for (const prop in obj) {
      if (Object.hasOwn(obj, prop)) {
        return false;
      }
    }
  
    return true;
  }

export function round(num: number, decimals: number): number {
    var decimals = 10 ** decimals;
    return Math.round((num + Number.EPSILON) * decimals) / decimals;
}