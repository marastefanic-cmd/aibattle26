declare module 'mammoth' {
  interface ConvertResult { value: string; messages: { type: string; message: string }[] }
  export function convertToMarkdown(input: { path: string } | { buffer: Buffer }): Promise<ConvertResult>;
  export function extractRawText(input: { path: string } | { buffer: Buffer }): Promise<ConvertResult>;
}
