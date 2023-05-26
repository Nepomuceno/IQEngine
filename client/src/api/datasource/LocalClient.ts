import { DataSourceClient } from './DataSourceClient';
import store from '../../Store/store';
import { FileWithDirectoryAndFileHandle } from 'browser-fs-access';

export class LocalClient implements DataSourceClient {
  async get_datasource_meta(dataSource: string): Promise<any> {
    if (!store.getState().localDirectoryReducer?.localFiles) {
      return Promise.resolve([]);
    }
    const localFiles: FileWithDirectoryAndFileHandle[] = store.getState().localDirectoryReducer.localFiles;
    let result = [];
    for (let i = 0; i < localFiles.length; i++) {
      const file = localFiles[i];
      if (file.name.split('.').pop() !== 'sigmf-meta') {
        continue;
      }
      const fileContent = await file.text();
      result.push({
        name: file.name,
        path: file.webkitRelativePath,
        meta: JSON.parse(fileContent),
      });
    }
    return Promise.resolve(result);
  }
  update_meta(dataSource: string, filePath: string, meta: object): Promise<any> {
    throw new Error('Method not implemented.');
  }
  list(): Promise<any> {
    const localDirectory: FileWithDirectoryAndFileHandle[] = store.getState().localDirectoryReducer.localFiles;
    if (!localDirectory) {
      return Promise.resolve([]);
    }
    var directory = localDirectory[0].directoryHandle;
    return Promise.resolve([
      {
        name: directory.name,
        accountName: 'local',
        containerName: 'local',
        description: directory.name,
      },
    ]);
  }
  get(dataSource: string): Promise<any> {
    throw new Error('Not implemented');
  }
  get_meta(dataSource: string, filePath: string): Promise<any> {
    throw new Error('Not implemented');
  }
  features() {
    return {
      update_meta: false,
    };
  }
}
