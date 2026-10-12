import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Home Automation Control',
    short_name: 'Automation',
    description: 'Điều phối Windows Agent tại nhà',
    start_url: '/',
    display: 'standalone',
    background_color: '#0c1826',
    theme_color: '#0c1826',
    lang: 'vi',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
