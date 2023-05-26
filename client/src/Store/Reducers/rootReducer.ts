// Copyright (c) 2022 Microsoft Corporation
// Copyright (c) 2023 Marc Lichtman
// Licensed under the MIT License

import { combineReducers } from '@reduxjs/toolkit';
import blobReducer from './BlobReducer';
import connectionReducer from './ConnectionReducer';
import fetchMetaReducer from './FetchMetaReducer';
import recordingsListReducer from './RecordingsListReducer';
import minimapReducer from './MinimapReducer';
import { localDirectoryReducer } from './LocalDirectoryReducer';

export type RootState = ReturnType<typeof rootReducer>;

const rootReducer = combineReducers({
  blobReducer,
  connectionReducer,
  fetchMetaReducer,
  recordingsListReducer,
  minimapReducer,
  localDirectoryReducer,
});

export default rootReducer;
