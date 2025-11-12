declare module "nodejieba" {
  export function cut(sentence: string, hmm?: boolean): string[]
  export function load(dictPath?: string): void

  const nodejieba: {
    cut: typeof cut
    load: typeof load
  }

  export default nodejieba
}
