/** How the OS spells paths: Windows with drives and backslashes, every other platform with POSIX slashes. */
export const pathStyleOf = (platform: string) => (platform === 'win32' ? 'windows' : 'posix')
export type PathStyle = ReturnType<typeof pathStyleOf>

const windowsDrive = /^[a-z]:[\\/]/i
const windowsShare = /^[\\/]{2}[^\\/]/
const windowsSeparator = /[\\/]/
const windowsForbidden = /[<>:"|?*\p{Cc}]/u
/** Device names Windows reserves in every folder, alone or before an extension. */
const windowsReserved = /^(?:con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?:\.|$)/i

/** First problem of each folder name in a Windows path, null when every name is allowed. */
const windowsNameProblem = (names: ReadonlyArray<string>) => {
  for (const [index, name] of names.entries()) {
    // a single trailing separator leaves an empty name at the end, which Windows accepts
    if (name === '') {
      if (index === names.length - 1) continue
      return 'The path has two separators in a row.'
    }
    if (name === '.' || name === '..') continue
    if (windowsForbidden.test(name)) return 'Folder names cannot contain < > : " | ? * or control characters.'
    if (/[ .]$/.test(name)) return 'Folder names cannot end with a space or a dot.'
    const reserved = windowsReserved.exec(name)
    if (reserved !== null)
      return `${reserved[0].replace('.', '').toUpperCase()} is a device name that Windows reserves.`
  }
  return null
}

const windowsProblem = (path: string) => {
  if (windowsDrive.test(path)) return windowsNameProblem(path.slice(3).split(windowsSeparator))
  if (!windowsShare.test(path)) return 'Start the path with a drive, such as C:\\, or a network share.'
  const names = path.slice(2).split(windowsSeparator)
  const [server = '', share = ''] = names
  if (server === '' || share === '') return 'A network path needs a server and a share, such as \\\\server\\share.'
  return windowsNameProblem(names)
}

const posixProblem = (path: string) => {
  if (!path.startsWith('/')) return 'Start the path with /, from the root of the file system.'
  if (path.includes('\0')) return 'The path cannot contain a null character.'
  return null
}

/** Why a path cannot be a folder on an OS of the given style, such as a character Windows forbids or a missing root; null for a well-formed absolute path. */
export const pathProblem = (path: string, style: PathStyle) =>
  style === 'windows' ? windowsProblem(path) : posixProblem(path)
