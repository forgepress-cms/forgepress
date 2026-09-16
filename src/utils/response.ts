export function isPage(response: Response): boolean {
  return response.headers.get('content-type')?.includes('text/html') === true
}
