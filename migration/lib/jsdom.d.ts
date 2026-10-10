// jsdom ships no types and @types/jsdom isn't installed; ingest.ts uses only this.
declare module 'jsdom' {
  export class JSDOM {
    constructor(html: string)
    window: { document: Document }
  }
}
