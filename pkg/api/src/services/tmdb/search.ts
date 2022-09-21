import http from 'http';
import axios from 'axios';
import Promise from 'bluebird';
import sanitize from 'sanitize-filename';

import externalConfig from "@/config/env/external";
import { config } from '@/config/index';
import logger from '@/loaders/logger';
import onServer from '@/services/plex/server';
import { movieLookup } from '@/services/tmdb/movie';
import { showLookup } from '@/services/tmdb/show';

const agent = new http.Agent({ family: 4 });

async function search(term) {
  logger.verbose(`TMDB Search ${term}`, { label: 'tmdb.search' });

  const [movies, shows, people, companies] = await Promise.all([
    searchMovies(sanitize(term)),
    searchShows(sanitize(term)),
    searchPeople(sanitize(term)),
    searchCompanies(sanitize(term)),
  ]);

  await Promise.map(
    movies.results,
    async (result: any, i) => {
      movieLookup(result.id, true);
      const res: any = await onServer('movie', false, false, result.id);
      movies.results[i].on_server = res.exists;
    },
    { concurrency: config.get('general.concurrency') },
  );

  await Promise.map(
    shows.results,
    async (result: any, i) => {
      showLookup(result.id, true);
      const res: any = await onServer('show', false, false, result.id);
      shows.results[i].on_server = res.exists;
    },
    { concurrency: config.get('general.concurrency') },
  );

  return {
    movies: movies.results,
    shows: shows.results,
    people: people.results,
    companies: companies.results,
  };
}
export default search;

async function searchMovies(term) {
  const tmdb = 'https://api.themoviedb.org/3/';
  const url = `${tmdb}search/movie?query=${term}&include_adult=false&api_key=${externalConfig.tmdbApiKey}&append_to_response=credits,videos`;
  try {
    const res = await axios.get(url, { httpAgent: agent });
    return res.data;
  } catch (err) {
    logger.error('Error searching for movies', {
      label: 'tmdb.search',
    });
    return {
      results: [],
    };
  }
}

async function searchShows(term) {
  const tmdb = 'https://api.themoviedb.org/3/';
  const url = `${tmdb}search/tv?query=${term}&include_adult=false&api_key=${externalConfig.tmdbApiKey}&append_to_response=credits,videos`;
  try {
    const res = await axios.get(url, { httpAgent: agent });
    return res.data;
  } catch (err) {
    logger.error('Error searching for shows', {
      label: 'tmdb.search',
    });
    return {
      results: [],
    };
  }
}

async function searchPeople(term) {
  const tmdb = 'https://api.themoviedb.org/3/';
  const url = `${tmdb}search/person?query=${term}&include_adult=false&api_key=${externalConfig.tmdbApiKey}&append_to_response=credits,videos`;
  try {
    const res = await axios.get(url, { httpAgent: agent });
    return res.data;
  } catch (err) {
    logger.error('Error searching for people', {
      label: 'tmdb.search',
    });
    return {
      results: [],
    };
  }
}

async function searchCompanies(term) {
  const tmdb = 'https://api.themoviedb.org/3/';
  const url = `${tmdb}search/company?query=${term}&api_key=${externalConfig.tmdbApiKey}`;
  try {
    const res = await axios.get(url, { httpAgent: agent });
    return res.data;
  } catch (err) {
    logger.error('Error searching for companies', {
      label: 'tmdb.search',
    });
    return {
      results: [],
    };
  }
}
