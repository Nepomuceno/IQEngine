// Copyright (c) 2022 Microsoft Corporation
// Copyright (c) 2023 Marc Lichtman
// Licensed under the MIT License

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import parseMeta from '../../Utils/parseMeta';
import { useDispatch } from 'react-redux';
import { setLocalDirHandle } from '../../Store/Actions/LocalDirectoryActions';
import { getDataSourceMeta } from '../../api/datasource/Queries';
import { directoryOpen, fileOpen, supported, FileWithDirectoryAndFileHandle } from 'browser-fs-access';

const LocalFileBrowser = (props) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const metadatas = getDataSourceMeta('local', 'localDataSource');

  useEffect(() => {
    if (metadatas.data && metadatas.data.length > 0) {
      const entries = [];
      metadatas.data.forEach((metadata) => {
        try {
          const parsed = parseMeta(JSON.stringify(metadata.meta), 'local/', metadata.path, null, null);
          entries.push(parsed);
        } catch (e) {
          console.log(e);
        }
      });
      props.fetchRecordingsList({ entries: entries });
      navigate('/recordings');
    }
  }, [metadatas.data]);

  const directoryPickerAvailable = supported; // not all browsers support it yet

  const openFile = async () => {
    const [handle1, handle2] = await fileOpen({ multiple: true });
    if (handle1.name.includes('.sigmf-meta')) {
      props.updateConnectionMetaFileHandle(handle1); // store it in redux
      props.updateConnectionDataFileHandle(handle2); // assume other file is data
    } else {
      props.updateConnectionMetaFileHandle(handle2);
      props.updateConnectionDataFileHandle(handle1);
    }
    navigate('/recordings/spectrogram/localfile'); // dont include filename so that it wont get included in google analytics
  };

  const openDir = async () => {
    const dirHandle = (await directoryOpen({
      recursive: true,
    })) as FileWithDirectoryAndFileHandle[];
    dispatch(setLocalDirHandle(dirHandle));
    metadatas.refetch();
  };

  return (
    // <div className="container-fluid col-4">
    <div className="flexOne repocard">
      <div className="repocardheader">Browse Local Files</div>
      <div className="repocardbody">
        <center>
          {directoryPickerAvailable && (
            <>
              <button
                className="p-2 m-3 rounded-lg outline outline-1 outline-iqengine-primary hover:bg-iqengine-tertiary hover:text-black"
                onClick={openDir}
              >
                Open Local Directory
              </button>
              <br />
              OR
            </>
          )}
          <br />
          <button
            className="p-2 m-3 rounded-lg outline outline-1 outline-iqengine-primary hover:bg-iqengine-tertiary hover:text-black"
            onClick={openFile}
          >
            Select 1 .sigmf-meta
            <br />
            and 1 .sigmf-data
          </button>
          <div className="text-gray-500 mb-3">
            Note: FFTs and visualizations are done client-side (the data won't be uploaded anywhere)
          </div>
        </center>
      </div>
    </div>
  );
};

export default LocalFileBrowser;
