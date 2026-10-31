/**
 * Where files handed to other apps (share sheet) are written.
 *
 * Not the cache folder: Android empties app caches when the phone is low on
 * storage, which can delete a file before the receiving app (email, WhatsApp,
 * Drive) has read it. Files here are kept until the next share of the same
 * kind, then replaced, so at most one of each stays on the phone.
 */

import * as FileSystem from 'expo-file-system/legacy';

export const SHARE_DIR = () => `${FileSystem.documentDirectory}shared/`;

/**
 * Make sure the folder exists, delete earlier files starting with `prefix`,
 * and return the path for the new file.
 */
export async function prepareShareFile(prefix, fileName) {
  const dir = SHARE_DIR();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  try {
    const names = await FileSystem.readDirectoryAsync(dir);
    await Promise.all(names
      .filter((name) => name.startsWith(prefix))
      .map((name) => FileSystem.deleteAsync(`${dir}${name}`, { idempotent: true })));
  } catch (e) {
    console.warn('[shareFiles] Could not clear earlier files:', e.message);
  }
  return `${dir}${fileName}`;
}
