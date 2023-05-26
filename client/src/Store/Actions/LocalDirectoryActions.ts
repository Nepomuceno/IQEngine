import { FileWithDirectoryAndFileHandle } from 'browser-fs-access';

export const SET_LOCAL_DIR_HANDLE = 'SET_LOCAL_DIR_HANDLE';

export const setLocalDirHandle = (payload: FileWithDirectoryAndFileHandle[]) => ({
  type: SET_LOCAL_DIR_HANDLE,
  payload,
});
