import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import axios from 'axios';
import lineReader from 'line-reader';

import pathsConfig from "@/config/env/paths";
import logger from '@/loaders/logger';
import Imdb from '@/models/imdb';

export async function lookup(imdb_id) {
  if (!imdb_id) {
    return false;
  }

  const data = await Imdb.findOne({ id: imdb_id }).exec();
  if (!data) return false;
  return {
    rating: { ratingValue: data.rating },
    description: false,
  };
}

export async function storeCache(firstTime = false) {
  if (firstTime) {
    const exists = await Imdb.findOne({}).exec();
    if (exists) {
      logger.verbose('IMDB: Cache exists skipping setup', {
        label: 'meta.imdb',
      });
      return;
    }
  }
  const unzip = zlib.createGunzip();
  const tempFile = path.join(pathsConfig.data, './imdb_dump.txt');
  logger.verbose('IMDB: Rebuilding Cache', { label: 'meta.imdb' });
  try {
    logger.verbose('IMDB: Cache Downloading latest cache', {
      label: 'meta.imdb',
    });
    const res = await axios({
      url: 'https://datasets.imdbws.com/title.ratings.tsv.gz',
      method: 'GET',
      responseType: 'stream',
    });
    logger.verbose('IMDB: Cache Storing to temp', { label: 'meta.imdb' });
    const fileStream = fs.createWriteStream(tempFile);
    res.data.pipe(unzip).pipe(fileStream);
    fileStream.on('close', async () => {
      logger.verbose('IMDB: Cache Download complete', { label: 'meta.imdb' });
      try {
        await parseData(tempFile);
        logger.verbose('IMDB: Cache Finished', { label: 'meta.imdb' });
      } catch (e) {
        logger.error(e, { label: 'meta.imdb' });
        logger.error('IMDB: Cache failed - db write issue', {
          label: 'meta.imdb',
        });
      }
    });
  } catch (e) {
    logger.error(e, { label: 'meta.imdb' });
  }
}

async function parseData(file): Promise<any> {
  logger.verbose('IMDB: Cache Emptying old cache', { label: 'meta.imdb' });
  await Imdb.deleteMany({}).exec();
  logger.verbose('IMDB: Cache cleared', { label: 'meta.imdb' });
  logger.verbose('IMDB: Cache parsing download, updating local cache', {
    label: 'meta.imdb',
  });
  return new Promise((resolve, reject) => {
    let buffer: any = [];
    lineReader.eachLine(file, async (line, last, cb) => {
      const data = line.split('\t');
      if (data[0] === 'tconst' || (parseInt(data[2]) < 1000 && !last)) {
        cb();
        return;
      }
      if (buffer.length < 50000) {
        buffer.push({
          insertOne: {
            document: {
              id: data[0],
              rating: data[1],
            },
          },
        });
        if (!last) {
          cb();
          return;
        }
      }
      try {
        await processBuffer(buffer);
        buffer = [];
        if (last) {
          resolve(buffer);
        }
        cb();
      } catch {
        cb(false);
        reject();
      }
    });
  });
}

async function processBuffer(data) {
  await Imdb.bulkWrite(data);
}
