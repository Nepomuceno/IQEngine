import axios from 'axios';
import { MetadataClient } from './MetadataClient';
import { SigMFMetadata, Annotation, CaptureSegment } from '@/utils/sigmfMetadata';

export class ApiClient implements MetadataClient {
  async getMeta(account: string, container: string, filePath: string): Promise<SigMFMetadata> {
    const response = await axios.get(`/api/datasources/${account}/${container}/${filePath}/meta`);
    let responseMetaData: SigMFMetadata | null = null;
    responseMetaData = Object.assign(new SigMFMetadata(), response.data);
    responseMetaData.annotations = responseMetaData.annotations?.map((annotation) =>
      Object.assign(new Annotation(), annotation)
    );
    responseMetaData.captures = responseMetaData.captures?.map((capture) =>
      Object.assign(new CaptureSegment(), capture)
    );
    return responseMetaData;
  }

  async getDataSourceMetaPaths(account: string, container: string): Promise<string[]> {
    const response = await axios.get(`/api/datasources/${account}/${container}/meta/paths`);
    return response.data;
  }

  async updateMeta(account: string, container: string, filePath: string, meta: SigMFMetadata): Promise<SigMFMetadata> {
    return await axios
      .put(`/api/datasources/${account}/${container}/${filePath}/meta`, meta)
      .then((response) => {
        return Promise.resolve(meta as SigMFMetadata);
      })
      .catch((error) => {
        console.error(error);
        throw new Error('Failed to update metadata.');
      });
  }

  async queryMeta(queryString: string): Promise<SigMFMetadata[]> {
    const response = await axios.get(`/api/datasources/query?${queryString}`)
    return response.data.map((item, i) => {
      item = Object.assign(new SigMFMetadata(), item);
      item.annotations = item.annotations?.map((annotation) =>
        Object.assign(new Annotation(), annotation)
      );
      item.captures = item.captures?.map((capture) =>
        Object.assign(new CaptureSegment(), capture)
      );
      return item;
    });
  }

  features() {
    return {
      canUpdateMeta: true,
    };
  }
}
