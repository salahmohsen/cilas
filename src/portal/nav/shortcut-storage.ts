const keyOf = (accountId: number) => `portal-shortcut-off-${accountId}`

/** Whether the sidebar key is on for this account in this browser. Storage that throws reads as on. */
export const readShortcutOn = (storage: Pick<Storage, 'getItem'>, accountId: number): boolean => {
  try {
    return storage.getItem(keyOf(accountId)) !== '1'
  } catch {
    return true
  }
}

/** Keeps the setting for this account in this browser. Storage that throws keeps nothing. */
export const writeShortcutOn = (
  storage: Pick<Storage, 'setItem'>,
  accountId: number,
  on: boolean,
): void => {
  try {
    storage.setItem(keyOf(accountId), on ? '0' : '1')
  } catch {
    // Blocked storage: the setting lasts for this page only.
  }
}
