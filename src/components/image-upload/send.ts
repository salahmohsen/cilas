/**
 * Posts a form with XMLHttpRequest, the one browser request that reports
 * upload progress. `onProgress` gets 0 to 1 as bytes go out; `signal` aborts.
 * Resolves with the response's JSON, whatever its status.
 */
export const sendWithProgress = <T>(
  url: string,
  body: FormData,
  { onProgress, signal }: { onProgress?: (progress: number) => void; signal?: AbortSignal } = {},
) =>
  new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', url)
    request.responseType = 'json'
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total)
    }
    request.onload = () =>
      request.response === null ? reject(new Error('response')) : resolve(request.response as T)
    request.onerror = () => reject(new Error('network'))
    request.onabort = () => reject(new DOMException('Aborted', 'AbortError'))
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    signal?.addEventListener('abort', () => request.abort(), { once: true })
    request.send(body)
  })
