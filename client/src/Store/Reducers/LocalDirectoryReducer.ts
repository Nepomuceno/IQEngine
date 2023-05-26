import { SET_LOCAL_DIR_HANDLE } from '../Actions/LocalDirectoryActions';
import { AnyAction } from '@reduxjs/toolkit';
import { FileWithDirectoryAndFileHandle } from 'browser-fs-access';

interface LocalFileState {
  localFiles: FileWithDirectoryAndFileHandle[];
}

export const localDirectoryReducer = (state: LocalFileState = null, action: AnyAction) => {
  switch (action.type) {
    case SET_LOCAL_DIR_HANDLE:
      return {
        ...state,
        localFiles: action.payload,
      };
    default:
      return state;
  }
};
