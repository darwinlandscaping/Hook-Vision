export type Region = 'wa' | 'nq' | 'nt';

export interface RegionConfig {
  id: Region;
  location: string;
  subtitle: string;
  tagline: string;
  ctaLine: string;
  waters: string[];
  primaryColor: string;
  secondaryColor: string;
  skyFrom: string;
  skyTo: string;
}

export const REGIONS: Record<Region, RegionConfig> = {
  wa: {
    id: 'wa',
    location: 'KIMBERLEY, WA',
    subtitle: 'WILD COUNTRY · BIG FISH',
    tagline: 'Where Barramundi Rule',
    ctaLine: 'GET HOOKVISION — WA EDITION',
    waters: ['Fitzroy River', 'King Sound', 'Collier Bay'],
    primaryColor: '#FF6B00',
    secondaryColor: '#00C9A7',
    skyFrom: '#1a0a02',
    skyTo: '#0d1b2a',
  },
  nq: {
    id: 'nq',
    location: 'CAPE YORK, NQ',
    subtitle: 'TROPICAL TROPHY COUNTRY',
    tagline: 'Barra, Bream & Beyond',
    ctaLine: 'GET HOOKVISION — NQ EDITION',
    waters: ['Gulf of Carpentaria', 'Mitchell River', 'Archer River'],
    primaryColor: '#00C9A7',
    secondaryColor: '#FFB347',
    skyFrom: '#001a12',
    skyTo: '#031a20',
  },
  nt: {
    id: 'nt',
    location: 'DARWIN, NT',
    subtitle: 'TOP END · TOP WATER',
    tagline: 'Where the Big Ones Live',
    ctaLine: 'GET HOOKVISION — NT EDITION',
    waters: ['Daly River', 'Mary River', 'Kakadu Floodplains'],
    primaryColor: '#FF6B00',
    secondaryColor: '#00D4FF',
    skyFrom: '#100a00',
    skyTo: '#0a1520',
  },
};

export function getRegion(): RegionConfig {
  if (typeof window === 'undefined') return REGIONS.wa;
  const param = new URLSearchParams(window.location.search).get('region');
  const key = (param?.toLowerCase() ?? 'wa') as Region;
  return REGIONS[key] ?? REGIONS.wa;
}

export function useRegion(): RegionConfig {
  return getRegion();
}
