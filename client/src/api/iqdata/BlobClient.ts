import { IQDataClient } from './IQDataClient';
import { convertToFloat32 } from '@/utils/FetchMoreDataSource';
import { getBlobClient } from '@/api/utils/AzureBlob';
import { SigMFMetadata } from '@/utils/sigmfMetadata';
import { DataSource, IQDataSlice } from '@/api/Models';
import { BlobClient as AzureBlobClient } from '@azure/storage-blob';
import { groupContingousIndexes } from '@/utils/group';

export class BlobClient implements IQDataClient {
  dataSources: Record<string, DataSource>;

  constructor(dataSources: Record<string, DataSource>) {
    this.dataSources = dataSources;
  }
  async getIQDataBlocks(
    meta: SigMFMetadata,
    indexes: number[],
    blockSize: number,
    signal: AbortSignal
  ): Promise<IQDataSlice[]> {
    console.debug('getIQDataBlocks', indexes);
    const contingousIndexes = groupContingousIndexes(indexes);
    let { account, container, file_path } = meta.getOrigin();
    // if filePath does not finish in .sigmf-data, add it
    if (!file_path.endsWith('.sigmf-data')) {
      file_path += '.sigmf-data';
    }
    const content = await Promise.all(
      contingousIndexes.map((indexGroup) =>
        this.getIQDataBlockFromBlob(
          getBlobClient(this.dataSources, account, container, file_path),
          meta,
          indexGroup.start,
          indexGroup.count,
          blockSize,
          signal
        )
      )
    );
    return content.flat();
  }

  getIQDataSlices(
    meta: SigMFMetadata,
    indexes: number[],
    tileSize: number,
    signal: AbortSignal
  ): Promise<IQDataSlice[]> {
    return Promise.all(indexes.map((index) => this.getIQDataSlice(meta, index, tileSize, signal)));
  }

  async getIQDataSlice(
    meta: SigMFMetadata,
    index: number,
    tileSize: number,
    signal: AbortSignal
  ): Promise<IQDataSlice> {
    let { account, container, file_path } = meta.getOrigin();
    // if filePath does not finish in .sigmf-data, add it
    if (!file_path.endsWith('.sigmf-data')) {
      file_path += '.sigmf-data';
    }
    const blobClient = getBlobClient(this.dataSources, account, container, file_path);
    // Thi is ugly but it is the only way to get the blob as an ArrayBuffer
    return (await this.getIQDataBlockFromBlob(blobClient, meta, index, 1, tileSize, signal))[0];
  }

  async getIQDataBlockFromBlob(
    blobClient: AzureBlobClient,
    meta: SigMFMetadata,
    index: number,
    count: number,
    blockSize: number,
    signal: AbortSignal
  ): Promise<IQDataSlice[]> {
    console.log('getIQDataBlockFromBlob', blobClient.name, index, count, blockSize);
    let startTime = performance.now();
    const bytesPerSample = meta.getBytesPerIQSample();
    const offsetBytes = index * blockSize * bytesPerSample;
    const countBytes = blockSize * count * bytesPerSample;
    // Thi is ugly but it is the only way to get the blob as an ArrayBuffer
    const download = await blobClient.download(offsetBytes, countBytes, {
      abortSignal: signal,
    });
    const blobBody = await (await download.blobBody).arrayBuffer();
    const iqArray = convertToFloat32(blobBody, meta.getDataType());
    const iqBlocks: IQDataSlice[] = [];
    for (let i = 0; i < count; i++) {
      const offset = i * blockSize;
      const iqBlock = iqArray.slice(offset, offset + blockSize);
      iqBlocks.push({ index: index + i, iqArray: iqBlock });
    }
    console.debug(
      `get blob block ${blobClient.name} ${index} ${count} took:`,
      performance.now() - startTime,
      'ms',
      iqBlocks
    );
    return iqBlocks;
  }
}
